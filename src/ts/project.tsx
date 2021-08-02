import { useGlobalCtx } from "ts/globalcontext"
import { Electron, ObjectAny, ObjectGet, stringifyJSON } from "ts/ui"
import { basename, join, relative } from "path"
import { useCallback, useEffect } from "react"
import { watch } from "chokidar"
import { ensureDir, FSWatcher, pathExists, readFile, Stats, writeFile } from "fs-extra"
import { useSaveCtx } from "ts/savecontext"
import { useUndo } from "ts/undo"
import { ItemOptions, useSidebarCtx } from "ts/sidebar"
import { Map } from "ts/canvas"

const EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "bmp", "tga", "hdr", "pic", "exr"],
  code: ["lua"],
  audio: [
    "wav", "mp3", "ogg", "oga", "ogv", "699", "amf", "ams", "dbm", "dmf", "dsm",
    "far", "it", "j2b", "mdl", "med", "mod", "mt2", "mtm", "okt", "psm", "s3m", "stm",
    "ult", "umx", "xm", "abc", "mid", "pat", "flac"
  ]
}

type AssetAction = {
  type: "image" | "code" | "audio",
  path: string
}

const defaultProject = {
  settings: {
    auto_save: false,
    history_size: 10
  }
}

export const useProject = () => {
  const { data:{ path, loading, assets }, update } = useGlobalCtx("project", {
    path: null,
    loading: false,
    assets: { image:[], code:[], audio:[] }
  })
  const { all_data, data:savedata, load } = useSaveCtx("project", defaultProject)
  const { saveHistory, resetHistory } = useUndo(all_data, load, { size: savedata.settings.history_size })
  const { getItem, getItems } = useSidebarCtx()

  const addAsset = useCallback((type:AssetAction["type"], path:string) => {
    if (ObjectGet(assets, type) && !assets[type].includes(path))
      update({ 
        assets: {
          ...assets,
          [type]: [
            ...assets[type],
            path
          ]
        }
      })
  }, [assets, update])

  const fileUpdate = useCallback((name: any, stat: Stats) => {
    if (stat.isFile()) {
      const filename = basename(name)
      // update assets
      Object.typedKeys(EXTENSIONS)
        // only get extension types matching this file
        .filter((type) => EXTENSIONS[type].some(ext => filename.endsWith(`.${ext}`)))
        // add them to asset list
        .forEach((type) => addAsset(type, name))
    }
  }, [addAsset])

  const saveProject = useCallback(() => {
    if (all_data && path) {
      writeFile(join(path, 'blanke.json'), JSON.stringify({
        ...all_data,
        project: {
          ...all_data.project,
          path: undefined
        }
      }))

      const stringify_opts = { 
        language:"lua",
        array_width: {
          "layers.chunks.data": 16,
          "layers.objects.edges": 1,
          "layers.objects.polyline": 1
        }
      }

      // save maps 

      const formatMap = (mapdata:Map, tilesets:ItemOptions[]) => {
        let lastgid = 0
        const gids:ObjectAny<number> = {}
        const image_size:ObjectAny<[number,number]> = {}
        let last_obj_gid = 1
        const layerProperties = (lid:string) => {
          const layer = getItem(lid)
          return {
            visible: true,
            offset: 1,
            offsetx: layer.offset.x,
            offsety: layer.offset.y,
            parallaxx: 1,
            parallaxy: 1
          }
        }

        const ret = {
          version: "1.5",
          luaversion: "5.1",
          tiledversion: "1.7.1",
          orientation: "orthogonal",
          renderorder: "right-down",
          width: 100,
          height: 100,
          tilewidth: 32,
          tileheight: 32,
          nextlayerid: 0, // changes
          nextobjectid: 0, // changes 
          properties: {},
          tilesets: tilesets.map(tileset => {
            const [imagewidth, imageheight] = tileset.image_size
            const tilecount = tileset.tilecount
            image_size[tileset.image] = [imagewidth, imageheight]
            const frame = tileset.size ?? { w:1, h:1 }
            gids[tileset.id] = lastgid + 1
            lastgid += tilecount

            return {
              name: tileset.name,
              firstgid: gids[tileset.id],
              tilewidth: frame.w,
              tileheight: frame.h,
              spacing: 0,
              margin: 0,
              columns: Math.ceil(imagewidth / frame.w),
              image: relative(path, tileset.image),
              imagewidth,
              imageheight,
              objectalignment: "topleft",
              tileoffset: { x:0, y:0 },
              grid: {
                orientation: "orthogonal",
                width: frame.w,
                height: frame.h
              },
              properties: {},
              wangsets: {},
              tilecount,
              tiles: {}
            }
          }),
          layers: [
            ...Object.entries(mapdata.tiles || {}).map(([id, tiles], i) => {
              const layer = getItem(id)
              const chunk_size = [16, 16]
              const chunks:{x:number,y:number,width:number,height:number,data:number[]}[] = []
              tiles.forEach(tile => {
                const [imagewidth] = image_size[tile.tile.path]
                const [chunkx, chunky] = [
                  Math.floor(tile.y / (layer.snap.x * chunk_size[0])) - (tile.x < 0 ? layer.snap.x : 0),
                  Math.floor(tile.x / (layer.snap.y * chunk_size[1])) - (tile.y < 0 ? layer.snap.y : 0)
                ]
                let chunk = chunks.find(c => chunkx >= c.x && chunky >= c.y && chunkx < c.width && chunky < c.height)
                if (!chunk) {
                  chunk = { x:chunkx, y:chunky, width:chunk_size[0], height:chunk_size[1], data:(new Array(chunk_size[0] * chunk_size[1])).fill(0) }
                  chunks.push(chunk)
                }
                const [chunk_tilex, chunk_tiley] = [
                  Math.floor(tile.x / layer.snap.x),
                  Math.floor(tile.y / layer.snap.y)
                ]
                const [tilex, tiley] = [Math.floor(tile.tile.x / tile.tile.w), Math.floor(tile.tile.y / tile.tile.h)]
                const tile_columns = imagewidth / tile.tile.w

                const position_idx = Math.floor(chunk_tiley * chunk_size[0] + chunk_tilex) 
                const tile_idx = Math.floor(tiley * tile_columns + tilex) + gids[tile.id]

                if (position_idx < chunk.data.length - 1)
                  chunk.data[position_idx] = tile_idx
              })

              return {
                type: "tilelayer",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                id: i,
                name: getItem(id).name,
                ...layerProperties(id),
                properties: {},
                encoding: "lua",
                chunks
              }
            }),
            // depth probably doesn't need to be sorted with tiles
            ...Object.entries(mapdata.nodes || {}).reduce((objectgroups, [layerid, nodes]) => {
              const tileset_layers = Object.keys(mapdata.tiles).length

              nodes.forEach(node => {
                const layer = getItem(layerid)
                const node_options = getItem(node.id)
                let group = objectgroups.find(g => g.properties.z === layer.z && g.name === node_options.name)
                // add new object layer
                if (!group) {
                  group = {
                    type: "objectgroup",
                    draworder: "topdown",
                    id: tileset_layers + objectgroups.length,
                    name: `${layer.name}.Objects`,
                    ...layerProperties(layerid),
                    properties: {
                      z: layer.z, 
                      name: node_options.name
                    },
                    objects: []
                  }
                  objectgroups.push(group)
                }
                // add object to object layer
                const is_polyline = node.node.points.length > 1
                let least_x = node.node.points[0].x 
                let least_y = node.node.points[0].y
                if (is_polyline)
                  node.node.points.forEach(pt => {
                    if (pt.x < least_x && pt.y < least_y) {
                      least_x = pt.x 
                      least_y = pt.y
                    }
                  })

                const objinfo = {
                  id: last_obj_gid++,
                  name: node_options.name,
                  type: "",
                  shape: is_polyline ? "polyline" : "point",
                  x: least_x, 
                  y: least_y,
                  width: 0, 
                  height: 0,
                  rotation: 0,
                  visible: true,
                  edges: node.node.edges.map(([a,b]) => [
                    { x:a.x - least_x, y:a.y - least_y },
                    { x:b.x - least_x, y:b.y - least_y }
                  ]),
                  polyline: !is_polyline ? undefined : node.node.points.map(pt => ({
                    x: pt.x - least_x, y: pt.y - least_y
                  })),
                  properties: {}
                }
                group.objects.push(objinfo)
              })

              return objectgroups
            }, []).filter(g => g)
          ]
        }
        return ret
      }

      ensureDir(join(path, 'assets', 'map')).then(() => {
        Promise.all(getItems("tileset").map(tileset => new Promise<ItemOptions>((res) => {
          let img = new Image()
          img.src = `file://${tileset.image}`
          let image_size = [0, 0]
          if (tileset.crop)
            image_size = [tileset.crop.w, tileset.crop.h] 

          img.onload = () => {
            if (image_size[0] <= 0)
              image_size[0] = img.width 
            if (image_size[1] <= 0)
              image_size[1] = img.height
            tileset.image_size = [img.width, img.height]

            res(tileset)
          }
        })))
          .then(tilesets => Promise.all(
            Object.entries(all_data.canvas.maps)
              .map(([map, data]) =>  writeFile(join(path, 'assets', 'map', `${getItem(map).name}.lua`), stringifyJSON(formatMap(data as Map, tilesets), stringify_opts)))
          ))
      })
    }
  }, [all_data, path, getItem])

  const loadProject = useCallback((new_path, load_data) => {
    load({ ...defaultProject, ...load_data })
    update({ path:new_path, loading:false })
    resetHistory()
  }, [load, update, resetHistory])

  const openProjectDialog = useCallback(() => {
    // choose project location
    Electron.chooseFile({ folder:true })
    .then(result => {
      update({ loading:true })
      if (result.filePaths.length > 0) {
        const new_path = result.filePaths[0]
        const json_path = join(new_path, 'blanke.json')
        // if main.lua doesn't exist, ask if one should be created
        pathExists(json_path)
          .then(exists => {
            if (!exists) {
              return writeFile(json_path, JSON.stringify({}))
            } else {
              return readFile(json_path, 'utf8').then(JSON.parse)
            }
          })
          // load blanke.json
          .then(load_data => loadProject(new_path, load_data))
      } else {
        update({ path:null, loading:false })
      }
    })
    .catch(() => {
      update({ path:null, loading:false })
    })
  }, [loadProject, update])

  useEffect(() => {
    const auto_save = ObjectGet(savedata, "settings", "auto_save")
    if (auto_save) {
      saveProject()
    }
  }, [savedata, saveProject])
  
  useEffect(() => {
    let watcher:FSWatcher
    if (path) {
      // watch the directory for assets
      watcher = watch(path, {
        ignored: [
          "**/node_modules/**",
          /(^|[\/\\])\../
        ]
      })
      watcher.on('add', fileUpdate)
      watcher.on('change', fileUpdate)
    }

    return () => {
      if (watcher)
        watcher.close()
      watcher = null
    }
  }, [path, fileUpdate])

  return { 
    name: basename(path || "BlankE"),
    isOpen: !!path && !loading,
    settings: savedata.settings,
    path,
    assets,
    loading,
    openProjectDialog,
    saveProject,
    saveHistory
  }
}