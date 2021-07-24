import { ComponentProps, useCallback, useEffect, useRef, useState } from "react"
import { bem,  useWindowSize, ObjectAny, ObjectGet, FC } from "ts/ui"
import { useGlobalCtx } from "ts/globalcontext"
import * as PIXI from "pixi.js"
import { Stage, Container, Graphics, Text, Sprite } from "@inlet/react-pixi"
import { useSaveCtx } from "./savecontext"
// import { useProject } from "./project"

type TileCropInfo = { path:string, x:number, y:number, w:number, h:number }

type Point = { x:number, y:number }

type Layer = {
  z:number,
  snap:Point,
  offset:Point
}

type Map = {
  camera:Point,
  tiles:ObjectAny<ITile[]>
}

type CanvasCtx = { 
  /** currently selected tiles for placing */
  tiles:TileCropInfo[],
  current_layer:string,
  current_map:string,
  layers:ObjectAny<Layer>,
  maps:ObjectAny<Map>,
}

const bss = bem("canvas")

export const useCanvasCtx = () => {
  const { data:{ tiles }, update:updateGlobal } = useGlobalCtx("canvas", { tiles:[] })
  const { data:{ maps, layers = {}, current_layer, current_map }, update } = useSaveCtx<CanvasCtx>("canvas")

  const placeTile = useCallback((x:number, y:number) => {
    if (tiles && current_layer && current_map) {
      let minx:number, miny:number

      // snap position
      const layer = layers[current_layer]
      x -= x % layer.snap.x
      y -= y % layer.snap.y

      let new_tiles = tiles 
        // calculate x/y offsets
        .map(tile => {
          if (minx == null || tile.x < minx)
            minx = tile.x
          if (miny == null || tile.y < miny)
            miny = tile.y
          return tile
        })
        // place the tiles 
        .map(tile => ({ 
            x: x + (tile.x - minx), 
            y: y + (tile.y - miny), 
            tile 
        }))
        .map(tile => ({
          ...tile,
          key: `${current_layer},${tile.x},${tile.y}`
        }))
      const oldTiles = (maps[current_map].tiles[current_layer] || []).filter(t => !new_tiles.some(nt => nt.key === t.key))
      // :(
      update({ 
        maps:{ 
          ...maps, 
          [current_map]:{ 
            ...maps[current_map], 
            tiles: {
              ...maps[current_map].tiles,
              [current_layer]: [ 
                ...oldTiles,
                ...new_tiles
              ]
            }
          } 
        } 
      })
    }
  }, [current_layer, tiles, current_map, maps, update])

  const setSelectedTiles = useCallback((...args:TileCropInfo[]) => {
    updateGlobal({ tiles:args })
  }, [updateGlobal])

  const addLayer = useCallback((id:string, info:Partial<Layer>) => {
    update({ 
      layers:{ 
        ...layers, 
        [id]:{ 
          z:0, 
          snap: {x:0, y:0},
          offset: {x:0, y:0},
          ...info 
        } 
      },
      current_layer: current_layer || id
    })      
  }, [layers, current_layer, update])

  const removeLayer = useCallback((id:string) => {
    update({ layers:{ ...layers, [id]: null } })
  }, [layers, update])

  const setLayer = useCallback((id:string) => {
    update({ current_layer:id })
  }, [update])

  const updateLayer = useCallback((id:string, info:Partial<Layer>) => {
    if (layers[id])
      update({
        layers:{
          ...layers, 
          [id]: {
            ...layers[id],
            ...info
          }
        }
      })
  }, [layers, update])

  const setCurrentLayer = useCallback((id:string) => {
    if (layers[id])
      update({
        current_layer: id
      })
  }, [layers, update])

  const addMap = useCallback((id:string, info:Partial<Map>) => {
    update({ 
      maps:{ 
        ...maps, 
        [id]:{ 
          camera: {x:0, y:0},
          tiles: ObjectGet(maps, id, "tiles") || [],
          ...info,
        } 
      },
      current_map: current_map || id
    })      
  }, [maps, current_map, update])

  const removeMap = useCallback((id:string) => {
    update({ maps: { ...maps, [id]:null } })
  }, [maps, update])

  const setMap = useCallback((id:string) => {
    update({ current_map:id })
  }, [update])

  const updateMap = useCallback((id:string, info:Partial<Layer>) => {
    update({ 
      maps:{ 
        ...maps, 
        [id]:{ 
          camera: {x:0, y:0},
          ...info,
          // dont let tiles get overwritten so easily (use placeTile instead)
          tiles: ObjectGet(maps, id, "tiles") || []
        } 
      },
      current_map: current_map || id
    })      
  }, [maps, update])

  const setCurrentMap = useCallback((id:string) => {
    if (maps[id])
      update({
        current_map: id
      })
  }, [maps, update])

  return { 
    maps,
    current_map,
    layers, 
    current_layer,
    setSelectedTiles, 
    addLayer, removeLayer, setLayer, updateLayer, setCurrentLayer, 
    addMap, removeMap, setMap, updateMap, setCurrentMap,
    placeTile
  }
}

interface ITile {
  key:string,
  x:number, 
  y:number,
  tile:TileCropInfo,
  /** check the mouse button first! */
  onClick?:(e:PIXI.InteractionEvent) => void
}

const Tile:FC<ITile & ComponentProps<typeof Sprite>> = ({ x, y, tile, onClick, ...props }) => {
  const [texture, setTexture] = useState<PIXI.Texture<PIXI.Resource>>()
  const el_sprite = useRef<PIXI.Sprite>()

  useEffect(() => {
    let cancel = false
    PIXI.Texture.fromURL(`file://${tile.path}`)
      .then(texture => {
        let new_tex = texture.clone()

        let {x, y, w, h} = tile

        x = Math.max(0, Math.min(texture.width, x))
        y = Math.max(0, Math.min(texture.height,y))
        if (x + w > texture.width) 
          w -= (x + w) % texture.width
        if (y + h > texture.height)
          h -= (y + h) % texture.height

        new_tex.frame = new PIXI.Rectangle(x, y, w, h)
        if (!cancel) 
          setTexture(new_tex)
      })

    return () => {
      cancel = true
    }
  }, [tile, setTexture])

  const events = ['pointerover', 'pointerdown']
  useEffect(() => {
    if (el_sprite.current)
      events.forEach(evt => el_sprite.current.on(evt, onClick))

    return () => {
      if (el_sprite.current)
        events.forEach(evt => el_sprite.current.off(evt, onClick))
    }
  }, [el_sprite, onClick])

  return texture ? (
    <Sprite
      ref={el_sprite}
      texture={texture}
      x={x}
      y={y}
      {...props}
    />
  ) : null
}

export const Canvas = () => {
  const [width, height] = useWindowSize()
  const { layers, current_layer, maps, current_map, placeTile } = useCanvasCtx()

  const drawGrid = useCallback(grid => {
    if (grid)
      grid.clear()
    if (grid && current_layer && current_map) {
      const layer = layers[current_layer]
      grid.lineStyle({ width:1, color:0x212121, alpha:0.1 })

      let offx = layer.offset.x % layer.snap.x
      let offy = layer.offset.y % layer.snap.y

      if (layer.snap.x > 3)
        for (let x = offx; x < width + offx; x += layer.snap.x) {
          grid.moveTo(x, 0)
          grid.lineTo(x, height)
        }
      if (layer.snap.y > 3)
        for (let y = offy; y < height + offy; y += layer.snap.y) {
          grid.moveTo(0, y)
          grid.lineTo(width, y)
        }
    }
  }, [width, height, layers, current_layer, current_map])

  return (
    <div 
      className={bss()}
      onMouseDown={e => {
        if (e.buttons === 1)
          placeTile(e.clientX, e.clientY)
      }}
      onMouseOver={e => {
        if (e.buttons === 1)
          placeTile(e.clientX, e.clientY)
      }}
    >
      <Stage 
        width={width} 
        height={height}
        options={{
          backgroundColor: 0xEEEEEE
        }}
      >
        {/* grid */}
        <Container>
          <Graphics draw={drawGrid} />
        </Container>
        {/* layers */}
        <Container>
          {current_map && Object.keys(maps[current_map].tiles)
            .sort((a, b) => layers[a].z - layers[b].z)
            .map(id => (
              <Container key={id} alpha={current_layer === id ? 1 : 0.35}>
                {current_map && maps[current_map].tiles[id].map(tile => (
                  <Tile {...tile} onClick={e => {
                    // Right click
                    if (e.data.buttons === 1) {
                      console.log('ow', tile)
                    }
                  }}/>
                ))}
              </Container>
            ))}
        </Container>
        {/* overlay ui */}
        <Container>
          <Text 
          
          />
        </Container>
      </Stage>
    </div>
  )
}