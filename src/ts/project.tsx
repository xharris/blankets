import { useGlobalCtx } from "ts/globalcontext"
import { Electron, ObjectAny, ObjectGet, stringifyJSON } from "ts/ui"
import { basename, join } from "path"
import { useCallback, useEffect } from "react"
import { watch } from "chokidar"
import { ensureDir, FSWatcher, pathExists, readFile, Stats, writeFile } from "fs-extra"
import { useSaveCtx } from "ts/savecontext"
import { useUndo } from "ts/undo"
import { useSidebarCtx } from "ts/sidebar"
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
      // save maps 

      const formatMap = (mapdata:Map) => {
        let lastgid = 0
        const gids:ObjectAny<number> = {}
        const image_size:ObjectAny<[number,number]> = {}

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
          tilesets: getItems("tileset").map(tileset => {
            const [imagewidth, imageheight] = [
              tileset.crop.w || ((tileset.size.w || 0) - (tileset.crop.x || 0)),
              tileset.crop.h || ((tileset.size.h || 0) - (tileset.crop.y || 0))
            ]
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
              image: tileset.image,
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
                let [tilex, tiley] = [
                  tile.x - (tile.x % layer.snap.x),
                  tile.y - (tile.y % layer.snap.y)
                ]
                const [chunkx, chunky] = [
                  Math.floor(tile.y / (layer.snap.x * chunk_size[0])) - (tile.x < 0 ? layer.snap.x : 0),
                  Math.floor(tile.x / (layer.snap.y * chunk_size[1])) - (tile.y < 0 ? layer.snap.y : 0)
                ]
                // const data_idx = chunky * chunk_size[1] + chunkx
                let chunk = chunks.find(c => chunkx >= c.x && chunky >= c.y && chunkx < c.width && chunky < c.height)
                if (!chunk) {
                  chunk = { x:chunkx, y:chunky, width:chunk_size[0], height:chunk_size[1], data:(new Array(chunk_size[0] * chunk_size[1])).fill(0) }
                  chunks.push(chunk)
                }
                const [chunk_tilex, chunk_tiley] = [
                  Math.floor(tile.x / (chunk_size[0])),
                  Math.floor(tile.y / chunk_size[1])
                ]
                const position_idx = Math.floor(chunk_tilex * chunk_size[0] + chunk_tiley) 
                console.log(tilex, tiley, chunkx, chunky)
                const tile_idx = Math.floor(tile.tile.x * (image_size[tile.tile.path][0] / tile.tile.w) + tile.tile.y)
                console.log(tile_idx, chunk_tilex, chunk_tiley)
                chunk.data[position_idx] = tile_idx
              })

              return {
                type: "tilelayer",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                i,
                name: getItem(id).name,
                visible: true,
                opacity: 1,
                offsetx: 0,
                offsety: 0,
                parallaxx: 1,
                parallaxy: 1,
                properties: {},
                encoding: "lua",
                chunks
              }
            }),
            // ...Object.entries(mapdata.nodes || {}).map(([id, nodes], i) => {
            //   return {}
            // })
          ]
        }
        return ret
      }

      ensureDir(join(path, 'assets', 'map'))
        .then(() => 
          Promise.all(
            Object.entries(all_data.canvas.maps)
              .map(([map, data]) => 
                writeFile(join(path, 'assets', 'map', `${getItem(map).name}.lua`), stringifyJSON(formatMap(data as Map), { language:"lua" }))
              )
          )
        )
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