import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { bem,  useWindowSize } from "ts/ui"
import { useGlobalCtx } from "./globalcontext"
import * as PIXI from "pixi.js"
// import { Stage, Container, Sprite } from "@inlet/react-pixi"
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
  const { data:{ tiles, layers, current_layer }, update } = useGlobalCtx<CanvasCtx>("canvas")

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
    current_layer:current_layer && layers[current_layer],
    layer_container:current_layer && layers[current_layer]._container, 
    setSelectedTiles, addLayer, removeLayer, setLayer, updateLayer,
    setCurrentLayer
  }
}

export const Canvas = () => {
  const el_canvas = useRef<HTMLDivElement>()
  const [width, height] = useWindowSize()
  // const { assets } = useProject()
  const { tiles, layers, layer_container, current_layer } = useCanvasCtx()
  // PIXIjs
  // const [textures, setTextures] = useState<ObjectAny<PIXI.Texture>>({})
  const [app, setApp] = useState<PIXI.Application>()
  const [grid, setGrid] = useState<PIXI.Graphics>()
  const [tileContainer, setTileContainer] = useState<PIXI.Container>()
  // const [overlayContainer, setOverlayContainer] = useState<PIXI.Container>()
  // const [infoText, setInfoText] = useState<PIXI.Text>()

  // setup pixi.js
  useEffect(() => {
    if (el_canvas.current && !app) {
      let new_app = new PIXI.Application({ 
        backgroundColor:0xEEEEEE
      })
      el_canvas.current.appendChild(new_app.view)
      
      let new_grid = new PIXI.Graphics()
      let new_tile = new PIXI.Container()
      let new_overlay = new PIXI.Container()

      new_app.stage.addChild(new_grid, new_tile, new_overlay)
      setTileContainer(new_tile)
      // setOverlayContainer(new_overlay)

      setApp(new_app)
      setGrid(new_grid) 
    }
  }, [el_canvas, app, width, height])

  useEffect(() => {
    updateGrid()
  }, [current_layer])

  useEffect(() => {
    if (tileContainer && layers)
      Object.values(layers)
        .filter(layer => !layer._container.parent)
        .forEach(layer => tileContainer.addChild(layer._container))
  }, [layers, tileContainer])

  useLayoutEffect(() => {
    updateCanvasSize()
  }, [width, height, app])

  const getSprite = useCallback((tile:TileCropInfo) => {
    let new_spr = new PIXI.Sprite()
    PIXI.Texture.fromURL(`file://${tile.path}`)
      .then(texture => {
        new_spr.texture = texture.clone()

        let {x, y, w, h} = tile

        x = Math.max(0, Math.min(texture.width, x))
        y = Math.max(0, Math.min(texture.height,y))
        if (x + w > texture.width) 
          w -= (x + w) % texture.width
        if (y + h > texture.height)
          h -= (y + h) % texture.height

        new_spr.texture.frame = new PIXI.Rectangle(x, y, w, h)
      })
    return new_spr
  }, [])

  const updateGrid = useCallback(() => {
    if (grid && current_layer) {
      grid.clear()
      grid.lineStyle({ width:1, color:0x212121, alpha:0.1 })

      let offx = current_layer.offset.x % current_layer.snap.x
      let offy = current_layer.offset.y % current_layer.snap.y

      if (current_layer.snap.x > 3)
        for (let x = offx; x < width + offx; x += current_layer.snap.x) {
          grid.moveTo(x, 0)
          grid.lineTo(x, height)
        }
      if (current_layer.snap.y > 3)
        for (let y = offy; y < height + offy; y += current_layer.snap.y) {
          grid.moveTo(0, y)
          grid.lineTo(width, y)
        }
    }
  }, [width, height, grid, current_layer])

  const updateCanvasSize = useCallback(() => {
    if (app) {
      app.renderer.resize(width, height)
      updateGrid()
    }
  }, [width, height, app, updateGrid])

  const onPlace = useCallback((add:boolean, x:number, y:number) => {
    if (add && tiles && layer_container && current_layer) {
      let minx:number, miny:number
      x -= x % current_layer.snap.x 
      y -= y % current_layer.snap.y
      tiles 
        // calculate x/y offsets
        .map(tile => {
          if (minx == null || tile.x < minx)
            minx = tile.x
          if (miny == null || tile.y < miny)
            miny = tile.y
          return tile
        })
        // place the tiles 
        .forEach(tile => {
          const spr_tile = getSprite(tile)
          spr_tile.x = x + (tile.x - minx)
          spr_tile.y = y + (tile.y - miny)
          layer_container.addChild(spr_tile)
        })
    }
  }, [layer_container, current_layer, tiles])

  return (
    <div 
      className={bss()}
      ref={el_canvas} 
      onMouseDown={e => 
        onPlace(e.buttons === 1, e.clientX, e.clientY)
      }
      onMouseOver={e => {
        if (e.buttons !== 0)
          onPlace(e.buttons === 1, e.clientX, e.clientY)
      }}
    />
  )
}