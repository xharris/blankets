import { useCallback, useState } from "react"
import { bem,  useWindowSize, ObjectAny } from "ts/ui"
import { useGlobalCtx } from "./globalcontext"
import * as PIXI from "pixi.js"
import { Stage, Container, Graphics, Text, PixiComponent } from "@inlet/react-pixi"
// import { useProject } from "./project"

type TileCropInfo = { path:string, x:number, y:number, w:number, h:number }

type Point = { x:number, y:number }

type Layer = {
  _container:PIXI.Container, 
  z:number,
  snap:Point,
  offset:Point
}

type CanvasCtx = { 
  tiles:TileCropInfo[],
  current_layer:string,
  layer_container: PIXI.Container,
  layers:{ [id:string]:Layer },
}

const bss = bem("canvas")

export const useCanvasCtx = () => {
  const { data:{ tiles, layers = {}, current_layer }, update } = useGlobalCtx<CanvasCtx>("canvas")

  const setSelectedTiles = useCallback((...args:TileCropInfo[]) => {
    update({ tiles:args })
  }, [update])

  const addLayer = useCallback((id:string, info:Partial<Layer>) => {
    update({ 
      layers:{ 
        ...layers, 
        [id]:{ 
          z:0, 
          _container:new PIXI.Container(), 
          snap: {x:0, y:0},
          offset: {x:0, y:0},
          ...info 
        } 
      },
      current_layer: current_layer || id
    })      
  }, [layers, current_layer, update])

  const removeLayer = useCallback((id:string) => {
    if (layers[id])
      layers[id]._container.destroy()
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

  return { 
    tiles, 
    layers, 
    current_layer,
    layer_container:current_layer && layers[current_layer]._container, 
    setSelectedTiles, addLayer, removeLayer, setLayer, updateLayer,
    setCurrentLayer
  }
}

interface ITile {
  key:string,
  x:number, 
  y:number,
  tile:TileCropInfo
}

const Tile = PixiComponent<ITile, PIXI.Sprite>("Tile", {
  create: () => new PIXI.Sprite(),
  applyProps: (inst, _, { x, y, tile }) => {
    // load texture
    PIXI.Texture.fromURL(`file://${tile.path}`)
      .then(texture => {
        inst.texture = texture.clone()

        let {x, y, w, h} = tile

        x = Math.max(0, Math.min(texture.width, x))
        y = Math.max(0, Math.min(texture.height,y))
        if (x + w > texture.width) 
          w -= (x + w) % texture.width
        if (y + h > texture.height)
          h -= (y + h) % texture.height

        inst.texture.frame = new PIXI.Rectangle(x, y, w, h)
      })
    inst.x = x 
    inst.y = y
  }
})

export const Canvas = () => {
  const [width, height] = useWindowSize()
  // const { assets } = useProject()
  const { tiles, layers, current_layer } = useCanvasCtx()
  const [placedTiles, setPlacedTiles] = useState<ObjectAny<ITile[]>>({})

  const drawGrid = useCallback(grid => {
    if (grid && current_layer) {
      const layer = layers[current_layer]
      grid.clear()
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
  }, [width, height, current_layer])

  const onPlace = useCallback((add:boolean, x:number, y:number) => {
    if (add && tiles && current_layer) {
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
      const oldTiles = (placedTiles[current_layer] || []).filter(t => !new_tiles.some(nt => nt.key === t.key))
      setPlacedTiles({ ...placedTiles, [current_layer]:[ ...oldTiles, ...new_tiles ]})
    }
  }, [current_layer, tiles, placedTiles, setPlacedTiles])

  return (
    <div 
      className={bss()}
      onMouseDown={e => 
        onPlace(e.buttons === 1, e.clientX, e.clientY)
      }
      onMouseOver={e => {
        if (e.buttons !== 0)
          onPlace(e.buttons === 1, e.clientX, e.clientY)
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
          {Object.keys(placedTiles)
            .sort((a, b) => layers[a].z - layers[b].z)
            .map(id => (
              <Container key={id}>
                {placedTiles[id].map(tile => (
                  <Tile {...tile}/>
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