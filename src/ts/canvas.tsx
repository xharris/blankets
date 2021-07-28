import { ComponentProps, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { bem, useWindowSize, ObjectAny, ObjectGet, FC, useEvent, useTheme } from "ts/ui"
import { useGlobalCtx } from "ts/globalcontext"
import * as PIXI from "pixi.js"
import { Stage, Container, Graphics, BitmapText, Sprite, useApp } from "@inlet/react-pixi"
import { useSaveCtx } from "ts/savecontext"
import { useProject } from "ts/project"
import { app } from "@electron/remote"
import { ItemOptions, useSidebarCtx } from "ts/sidebar"
import { nanoid } from 'nanoid'
// import { useProject } from "./project"

type ElementType = "nodes"|"tiles"
type TileCropInfo = { path:string, x:number, y:number, w:number, h:number }
type NodeInfo = { points:Point[], edges:Edge[], label?:string }

type Edge = [Point, Point, string?]
type Point = { x:number, y:number, label?:string }

export type Map = {
  camera: Point,
  tiles?:ObjectAny<ITile[]>,
  nodes?:ObjectAny<INode[]>
}

type CanvasGlobalCtx = {
  tiles: TileCropInfo[],
  node_parts: Point[],
  selectedNode: string,
  draggingNode: boolean
}

type CanvasCtx = { 
  /** currently selected tiles for placing */
  tiles:TileCropInfo[],
  current_layer:string,
  current_map:string,
  maps:ObjectAny<Map>,
}

type IUpdateMap = <T>(map:string, layer:string, type:ElementType, value:T) => void

const sameEdge = (edge1:Edge, edge2:Edge) => (
  (
    edge1[0].x === edge2[0].x && edge1[0].y === edge2[0].y && 
    edge1[1].x === edge2[1].x && edge1[1].y === edge2[1].y
  ) ||
  ( 
    edge1[1].x === edge2[0].x && edge1[1].y === edge2[0].y &&
    edge1[0].x === edge2[1].x && edge1[0].y === edge2[1].y
  )
)
const edgeKey = (edge:Edge) => `${edge[0].x},${edge[0].y},${edge[1].x},${edge[1].y}`
const lineStyle = {
  join: PIXI.LINE_JOIN.ROUND
}

const bss = bem("canvas")

export const useCanvasCtx = () => {
  const { saveHistory } = useProject()
  const { data:{ tiles, node_parts, selectedNode, draggingNode }, update:updateGlobal } = useGlobalCtx<CanvasGlobalCtx>("canvas", { 
    tiles:[], 
    node_parts:[],
    selectedNode: "",
    draggingNode: false,
  })
  const { data:{ maps = {}, current_layer, current_map }, update } = useSaveCtx<CanvasCtx>("canvas")
  const { selectedItem, getItem, getItems } = useSidebarCtx()

  const updateMap:IUpdateMap = useCallback((map, layer, type, value) => {
    update({ 
      maps:{ 
        ...maps, 
        [map]:{ 
          ...maps[map], 
          [type]: {
            ...maps[map][type],
            [layer]: value
          }
        } 
      } 
    })
  }, [update, maps])

  const setDraggingNode = useCallback((v:boolean) => 
    updateGlobal({
      draggingNode: v
    })
  , [updateGlobal])

  const selectMapNode = useCallback((key:string = "", set?:boolean) => {
    updateGlobal({
      selectedNode: selectedNode === key && !set ? null : key
    })
  }, [updateGlobal, selectedNode])

  const deleteTile = useCallback((id:string, key:string) => {
    let changed
    let element_type = getItem(id).type
    let type = (element_type === "node" ? "nodes" : "tiles") as "nodes"|"tiles"

    updateMap(current_map, current_layer, type, 
      (maps[current_map][type][current_layer] as ICanvasElement[]).filter(t => {
        if (t.key === key)
          changed = true
        return t.key !== key
      })
    )
    
    if (changed)
      saveHistory()
  }, [maps, current_map, current_layer, saveHistory, getItem, updateMap])

  const placeTile = useCallback((x:number, y:number) => {
    if (tiles && tiles.length > 0 && current_layer && current_map) {
      let minx:number, miny:number

      // snap position
      const layer = getItem(current_layer)
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
          key: `${current_layer},${tile.x},${tile.y}`,
          id: selectedItem.id
        }))
        
      updateMap(current_map, current_layer, "tiles", 
      [
        ...(maps[current_map].tiles[current_layer] || []).filter(t => !new_tiles.some(nt => nt.key === t.key)), 
        ...new_tiles
      ])
    }
  }, [selectedItem, current_layer, tiles, current_map, maps, updateMap, getItem])

  useLayoutEffect(() => {
    if (node_parts.length > 0 && selectedItem && (!selectedItem.connect_type || selectedItem.connect_type === "none")) {
      finishNode()
    }
  }, [node_parts, selectedItem])

  const finishNode = useCallback(() => {
    if (node_parts.length > 0) {
      updateMap(current_map, current_layer, "nodes",
        [
          ...(ObjectGet<INode[]>(maps, current_map, "nodes", current_layer) || []),
          {
            key:nanoid(),
            id:selectedItem.id,
            node: { id:selectedItem.id, edges:[], points:[ ...node_parts ] }
          }
        ]
      )
      updateGlobal({
        node_parts: []
      })
      saveHistory()
    }
  }, [
    selectedItem, getItem, node_parts, maps, updateMap,
    updateGlobal, saveHistory, current_map, current_layer
  ])

  const resetNodePath = useCallback(() => {
    updateGlobal({
      node_parts: []
    })
  }, [updateGlobal])
  
  const getNode = useCallback((key:string, map:string, layer:string) => 
    maps[map].nodes[layer].find(node => node.key === key)
  , [maps])

  const updateNode = useCallback((node:INode|string, data:Partial<INode>) => {
    if (typeof node === "string")
      node = getNode(node, current_map, current_layer)
    updateMap(current_map, current_layer, "nodes",
      [
        ...(ObjectGet<INode[]>(maps, current_map, "nodes", current_layer) || []).filter(n => n.key !== (node as INode).key),
        {
          ...node,
          ...data
        }
      ]
    )
  }, [updateMap, current_map, current_layer, maps, getNode])

  const onPlace = useCallback((x:number, y:number) => {
    if (selectedNode) {
      // add vertex to node path
      const node = getNode(selectedNode, current_map, current_layer)
      updateNode(node, {
        ...node,
        node: {
          ...node.node,
          points: node.node.points.concat({x,y})
        }
      })
      saveHistory()
    } else if (selectedItem) {
      if (selectedItem.type === "tileset")
        placeTile(x, y)
      if (selectedItem.type === "node") {
        updateGlobal({
          node_parts: [ ...node_parts.filter(pt => !(pt.x === x && pt.y === y)), {x, y} ]
        })
      }
      saveHistory()
    }
  }, [
    placeTile, updateGlobal, node_parts, finishNode, 
    selectedNode, selectedItem, saveHistory,
    current_map, current_layer, getNode, updateNode
  ])

  const setSelectedTiles = useCallback((...args:TileCropInfo[]) => {
    updateGlobal({ tiles:args })
  }, [updateGlobal])

  const addLayer = useCallback((id:string) => {
    if (!current_layer)
      update({ 
        current_layer: current_layer || id
      })      
  }, [current_layer, update])

  const removeLayer = useCallback((id:string) => {
    Object.keys(maps)
      .forEach(map => {
        updateMap(map, id, "tiles", undefined)
        updateMap(map, id, "nodes", undefined)
      })
  }, [getItem, updateMap])

  const setLayer = useCallback((id:string) => {
    if (current_layer !== id)
      update({ current_layer:id })
  }, [update, current_layer])

  const addMap = useCallback((id:string) => {
    update({ 
      maps:{ 
        ...maps, 
        [id]:{ 
          camera: {x:0, y:0}
        } 
      },
      current_map: current_map || id
    })      
  }, [maps, current_map, update])

  const removeMap = useCallback((id:string) => {
    update({ maps: { ...maps, [id]:null } })
  }, [maps, update])

  const setMap = useCallback((id:string) => {
    if (current_map !== id)
      update({ current_map:id })
  }, [update, current_map])

  const setCamera = useCallback((x:number, y:number) => {
    if (current_map)
      update({
        maps: {
          ...maps,
          [current_map]: {
            ...maps[current_map],
            camera: { x, y }
          }
        }
      })
  }, [update, current_map, maps])

  const deleteNode = useCallback((key:string) => {
    updateMap(current_map, current_layer, "nodes", 
      ObjectGet<INode[]>(maps, current_map, "nodes", current_layer).filter((n:INode) => n.key !== key)
    )
    saveHistory()
  }, [updateMap, current_layer, current_map, saveHistory])

  // useEffect(() => {
  //   if (current_map) {
  //     setCamera({ ...maps[current_map].camera })
  //   }
  // }, [current_map, setCamera])

  const deleteNodePoint = useCallback((node?:INode, idx?:number) => {
    if (!node && node_parts.length > 1) {
      // undo node being created
      updateGlobal({
        node_parts: node_parts.slice(0, node_parts.length - 1)
      })
    } else {
      // remove already created node point
      const point = node.node.points.splice(idx, 1)[0]
      node.node.edges = node.node.edges.filter(edge => !sameEdge(edge, [edge[0], point]) && !sameEdge(edge, [edge[1], point]))
      updateMap(current_map, current_layer, "nodes",
        [
          ...ObjectGet<INode[]>(maps, current_map, "nodes", current_layer).filter((n:INode) => n.key !== node.key),
          node
        ]
      )
      saveHistory()
    }
  }, [maps, node_parts, updateGlobal, updateMap, current_layer, current_map, saveHistory])

  const toggleNodeEdge = useCallback((node:INode, start:Point, end:Point) => {
    const idx = node.node.edges.findIndex(edge => sameEdge(edge, [start, end]))
    // remove edge
    if (idx > -1) {
      node.node.edges.splice(idx, 1)
    }
    // add edge 
    else {
      node.node.edges.push([start, end])
    }
    updateMap(current_map, current_layer, "nodes", 
      [
        ...ObjectGet<INode[]>(maps, current_map, "nodes", current_layer).filter((n:INode) => n.key !== node.key),
        node
      ]
    )
    saveHistory()
  }, [maps, current_layer, current_map, updateMap, saveHistory])

  // check if things were added/removed
  useEffect(() => {
    // REMOVED
    Object.keys(maps).forEach(id => {
      if (!getItem(id))
        removeMap(id)
      else 
        // layers
        (["tiles", "nodes"] as ElementType[]).forEach((type) => {
          if (maps[id][type])
            Object.keys(maps[id][type]).forEach(lid => {
              if (!getItem(lid)) 
                removeLayer(lid)
            })
        })
    })
    // ADDED 
    getItems("map").forEach(map => {
      if (!maps[map.id])
        addMap(map.id)
    })
    getItems("layer").forEach(layer => {
      addLayer(layer.id)
    })
  }, [maps, getItem, getItems, removeMap, removeLayer, current_layer, addMap, addLayer])

  // layer/map selected
  useEffect(() => {
    if (selectedItem) {
      if (selectedItem.type === "map")
        setMap(selectedItem.id)
      if (selectedItem.type === "layer")
        setLayer(selectedItem.id)
    }
  }, [selectedItem, setMap, setLayer])

  return { 
    maps,
    current_map,
    current_layer,
    camera: { x:0, y:0 },
    node_parts,
    selectedNode,
    draggingNode,
    onPlace,
    setCamera,
    setSelectedTiles, 
    setDraggingNode,
    addLayer, removeLayer, 
    addMap, removeMap, 
    deleteTile, deleteNode, deleteNodePoint,
    finishNode, resetNodePath, toggleNodeEdge,
    selectMapNode, updateNode, getNode
  }
}

interface ICanvasElement {
  key:string,
  canvasKey?:string,
  id:string,
  x:number, 
  y:number,
  disabled?:boolean,
  onClick?:(e:PIXI.InteractionEvent) => void,
  onDelete?:(e:PIXI.InteractionEvent) => void,
  item?:ItemOptions,
  canvas?:ReturnType<typeof useCanvasCtx>
}

interface ITile extends ICanvasElement {
  tile:TileCropInfo,
}

const Tile:FC<ITile & ComponentProps<typeof Sprite>> = ({ x, y, tile, onClick, onDelete, disabled, ...props }) => {
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

  return texture ? (
    <Sprite
      ref={el_sprite}
      texture={texture}
      x={x}
      y={y}
      interactive={!disabled}
      pointerover={onClick}
      pointerdown={e => {
        if (!e.data.originalEvent.altKey && e.data.button === 2) {
          onDelete(e)
        } else {
          onClick(e)
        }
      }}
      {...props}
    />
  ) : null
}

interface INodeEdge {
  start:Point,
  end:Point,
  editing:boolean,
  active:boolean,
  onClick: (e:PIXI.InteractionEvent) => void
}

const NodeEdge:FC<INodeEdge & ComponentProps<typeof Graphics>> = ({ start, end, active, editing, onClick }) => {
  const [hovering, setHovering] = useState(false)
  const [hitArea, setHitArea] = useState<PIXI.Polygon>(null)
  const theme = useTheme()

  useEffect(() => {
    const m = -5
    const { x:x1, y:y1 } = start 
    const { x:x2, y:y2 } = end 
    const xsign = Math.sign(x1 - x2) == 0 ? 1 : Math.sign(x1 - x2)
    const ysign = Math.sign(y1 - y2) == 0 ? 1 : Math.sign(y1 - y2)
    
    setHitArea(new PIXI.Polygon([
      x1 + (m * xsign), y1,
      x1, y1 + (m * ysign),
      x2 - (m * xsign), y2,
      x2, y2 - (m * ysign)
    ]))
  }, [start, end])

  const drawEdge = useCallback((g:PIXI.Graphics) => {
    g.clear()
    const color = parseInt(theme.color.type.node, 16)
    // hovering: faded bold line
    if (hovering && editing) {
      g.lineStyle({ ...lineStyle, width: 4, color, alpha: 0.25 })
      g.moveTo(start.x, start.y)
      g.lineTo(end.x, end.y)
    }
    // active: bold line
    if (active) {
      g.lineStyle({ ...lineStyle, width: 2, color })
      g.moveTo(start.x, start.y)
      g.lineTo(end.x, end.y)
    }
    // weak line
    else {
      g.lineStyle({ ...lineStyle, width: 2, color, alpha: 0.25 })
      g.moveTo(start.x, start.y)
      g.lineTo(end.x, end.y)
    }
  }, [start, end, theme, hovering, active])


  return (
    <Graphics
      interactive={true}
      pointerdown={onClick}
      pointerover={() => setHovering(true)}
      pointerout={() => setHovering(false)}
      draw={drawEdge}
      hitArea={hitArea}
    />
  )
}

interface INode extends ICanvasElement {
  canvas:ReturnType<typeof useCanvasCtx>,
  sidebar:ReturnType<typeof useSidebarCtx>,
  editing:boolean,
  incomplete?:boolean,
  node:NodeInfo,
  size?:number,
  selected:boolean,
  onEdgeClick:(start:Point, end:Point, e?:PIXI.InteractionEvent) => void,
  onPointDelete:(idx:number) => void,
}

const Node:FC<INode & ComponentProps<typeof Container>> = ({ canvasKey, canvas, sidebar, id, item, node, selected, size=3, incomplete, editing, onPointDelete, onEdgeClick, onDelete, ...props }) => {
  const [edges, setEdges] = useState<Edge[]>([])
  const theme = useTheme()
  const { points, edges:nodeEdges } = node
  const { getItem, selectItem } = sidebar
  const { 
    camera, current_layer, selectedNode,  
    selectMapNode, updateNode, setDraggingNode 
  } = canvas
  const [dragging, setDragging] = useState(-1)
  
  const extra_hit = size < 10 ? 10 : size
  const can_select_map_node = item.connect_type !== "none"
  const layer = getItem(current_layer)

  // TODO: efficiency needed? only updateNode on mouseup
  useEvent("mousemove", (e:MouseEvent) => {
    if (dragging > -1 && layer) {
      const [x,y] = [e.clientX - camera.x, e.clientY - camera.y]
      const new_pos = layer ? {
        x: x - (x % layer.snap.x),
        y: y - (y % layer.snap.y)
      } : {
        x, y
      }
      
      updateNode(canvasKey, {
        node: {
          ...node,
          points: points.map((pt, i) => {
            if (i === dragging) {
              return {
                x: new_pos.x,
                y: new_pos.y
              }
            }
            return pt
          })
        }
      })
    }
  }, [dragging, updateNode, layer, canvasKey, points])

  useEvent("mouseup", () => {
    setDraggingNode(false)
    setDragging(-1)
  }, [setDragging, setDraggingNode])

  useEffect(() => {
    // TODO: does not update edges when points are deleted
    // console.log(points.length)
    if (item.connect_type === "graph") {
      let new_edges:Edge[] = []
      points.forEach((pt) => {
        points.forEach((pt2) => {
          // made sure edge does not already exist
          if (!(pt.x === pt2.x && pt.y === pt2.y) && !new_edges.some(edge => sameEdge(edge, [pt, pt2]))) { 
            // add it
            new_edges.push([pt, pt2])
          }
        })
      })
      setEdges(new_edges)
    }
  }, [item, points, setEdges])

  const drawPoint = useCallback((g:PIXI.Graphics) => {
    g.clear()
    const color = parseInt(theme.color.type.node, 16)
    g.lineStyle({ ...lineStyle, width: 2, color })
    // vertex
    if (!(incomplete || selectedNode === canvasKey))
      g.beginFill(color, 0.25)
    g.drawRect(0, 0, size, size)
    if (!(incomplete || selectedNode === canvasKey))
      g.endFill()
    // corner position marker
    if (item.connect_type === "none")
      g.drawRect(-2, -2, 4, 4)
  }, [item, theme, incomplete, size, selectedNode, canvasKey])

  return (
    <Container
      {...props}
      alpha={selected ? 1 : 0.75}
    >
      {item.connect_type === "path" && points.map((pt, i) => i > 0 ? (
        <NodeEdge
          key={`${edgeKey([points[i-1], pt])},${i}`}
          start={points[i-1]}
          end={pt}
          onClick={e => {
            onEdgeClick(points[i-1], pt, e)
            // add node to middle of edge
            if (item.connect_type === "path" && selectedNode === canvasKey && dragging === -1 && layer) {
              let [x, y] = [
                (points[i-1].x + pt.x) / 2,
                (points[i-1].y + pt.y) / 2
              ]
              x = x - (x % layer.snap.x)
              y = y - (y % layer.snap.y)
              if (!points.find(pt2 => pt2.x === x && pt2.y === y)) {
                points.splice(i, 0, { x, y })
                updateNode(canvasKey, {
                  node: {
                    ...node,
                    points 
                  }
                })
              }
            }
          }}
          active={true}
          editing={false}
        />
      ) : null)}
      {item.connect_type === "graph" && (
        editing && selected ? edges.map(edge => (
          <NodeEdge 
            key={edgeKey(edge)} 
            start={{ x:edge[0].x, y:edge[0].y }}
            end={{ x:edge[1].x, y:edge[1].y }}
            onClick={e => onEdgeClick(edge[0], edge[1], e)}
            active={nodeEdges.some(edge2 => sameEdge(edge2, edge))}
            editing={editing}
          />
        ))
        : nodeEdges.map(edge => (
          <NodeEdge 
            key={edgeKey(edge)} 
            start={{ x:edge[0].x, y:edge[0].y }}
            end={{ x:edge[1].x, y:edge[1].y }}
            onClick={e => editing ? onEdgeClick(edge[0], edge[1], e) : null}
            active={true}
            editing={editing}
          />
        ))
      )}
      {points.map((point, i) => (
        <Graphics
          key={`${point.x},${point.y},${i}`}
          x={item.connect_type === "none" ? point.x : point.x - (size/2)}
          y={item.connect_type === "none" ? point.y : point.y - (size/2)}
          interactive={true}
          hitArea={new PIXI.Rectangle(0, 0, extra_hit, extra_hit)}
          pointerdown={e => {
            if (!e.data.originalEvent.altKey && e.data.button === 2) {
              if (points.length > 1)
                onPointDelete(i)
              else 
                onDelete(e)
            }
            if (e.data.originalEvent.ctrlKey && e.data.button === 0 && can_select_map_node) {
              selectMapNode(canvasKey)
              selectItem(id, true)
            }
            if (e.data.button === 0) {
              setDraggingNode(true)
              setDragging(i)
            }
          }}
          draw={drawPoint}
        />
      ))}
      {points.length > 0 && (
        <BitmapText
          x={item.connect_type === "none" ? points[0].x + (size/2) : points[0].x}
          y={item.connect_type === "none" ? points[0].y - 4 : points[0].y - (size/2) - 4}
          text={selectedNode === canvasKey ? `[${item.name}]` : item.name}
          style={{ fontName: "proggy_scene", fontSize: 16, align: "left" }}
          anchor={[0.5,1]}
        />
      )}
    </Container>
  )
}

export const PointerLock = ({ enabled=false }) => {
  const app = useApp()

  useEffect(() => {
    if (enabled)
      app.view.requestPointerLock()
    else 
      document.exitPointerLock()
  }, [enabled])

  return <></>
}


if (!PIXI.Loader.shared.resources["ProggyScene"])
  PIXI.Loader.shared
    .add("ProggyScene", `file:///${app.getAppPath()}/src/sass/proggy_scene.fnt`)
    .load()
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
PIXI.settings.ROUND_PIXELS = true

export const Canvas = () => {
  const [width, height] = useWindowSize()
  const [dragging, setDragging] = useState<Point>()
  const [lockPointer, setLockPointer] = useState(false)
  const canvas = useCanvasCtx()
  const { 
    camera:mapCamera, setCamera:setMapCamera,
    current_layer, maps, current_map, node_parts, draggingNode,
    onPlace, deleteTile, finishNode, resetNodePath, deleteNode, deleteNodePoint, toggleNodeEdge,
    selectMapNode
  } = canvas
  const [focused, setFocused] = useState(false)
  const [mousePos, setMousePos] = useState({x:0, y:0})
  const sidebar = useSidebarCtx()
  const { getItem, selectedItem } = sidebar
  const [pathMode, setPathMode] = useState(false)
  const [lastMap, setLastMap] = useState("")

  const can_drag_camera = maps && current_map && focused
  const layer = getItem(current_layer)

  const [camera, setCamera] = useState({x:0,y:0})
  const moveCamera = useCallback((x:number, y:number) => {
    setCamera(prev => ({ x:prev.x + x, y:prev.y + y }))
  }, [setCamera])

  useEffect(() => {
    if (current_map !== lastMap) {
      setCamera({ ...mapCamera })
      setLastMap(current_map)
    }
  }, [current_map, mapCamera, lastMap, setLastMap, setCamera])

  const drawGrid = useCallback((grid:PIXI.Graphics) => {
    if (grid)
      grid.clear()
    if (grid && current_layer && current_map) {
      const layer = getItem(current_layer)
      const camera_offset = { x:camera.x % layer.snap.x, y:camera.y % layer.snap.y }

      let offx = (layer.offset.x % layer.snap.x) + camera_offset.x
      let offy = (layer.offset.y % layer.snap.y) + camera_offset.y

      if (layer.snap.x > 3)
        for (let x = offx; x < width + offx; x += layer.snap.x) {
          grid.lineStyle({ ...lineStyle, width:1, color:0x212121, alpha:0.1 })
          grid.moveTo(x, 0)
          grid.lineTo(x, height)
        }
      if (layer.snap.y > 3)
        for (let y = offy; y < height + offy; y += layer.snap.y) {
          grid.lineStyle({ ...lineStyle, width:1, color:0x212121, alpha:0.1 })
          grid.moveTo(0, y)
          grid.lineTo(width, y)
        }
    
      // draw origin
      grid.lineStyle({ ...lineStyle, width:2, color:0x212121, alpha:0.2 })
      grid.moveTo(camera.x, 0)
      grid.lineTo(camera.x, height)
      grid.moveTo(0, camera.y)
      grid.lineTo(width, camera.y)
    }
  }, [width, height, current_layer, current_map, camera, layer])

  useEvent("mousedown", (e:MouseEvent) => {
    if (e.button === 1 && !dragging && can_drag_camera) {
      setDragging({ ...maps[current_map].camera })
    }
  }, [dragging, setDragging, can_drag_camera])

  useEvent("mouseup", () => {
    setDragging(null)
    setMapCamera(camera.x, camera.y)
  }, [setDragging, camera, setMapCamera])

  useEvent("keydown", (e:KeyboardEvent) => {
    // get starting point for camera
    if (e.key === "Alt" && can_drag_camera) {
      setDragging({ ...maps[current_map].camera })
      setLockPointer(true)
    }
    if (e.key === "Enter") {
      finishNode()
    }
    // node path editing 
    if (e.key === "Control")
      setPathMode(true)
    // stop everything
    if (e.key === "Escape") {
      resetNodePath()
      selectMapNode()
    }
  }, [setDragging, maps, current_map, finishNode, setPathMode, resetNodePath])

  useEvent("keyup", (e:KeyboardEvent) => {
    if (e.key === "Alt") {
      setDragging(null)
      setLockPointer(false)
      setMapCamera(camera.x, camera.y)
    }
    if (e.key === "Control")
      setPathMode(false)
  }, [setDragging, setLockPointer, setPathMode, setMapCamera, camera])

  useEvent("mousemove", (e:MouseEvent) => {
    if (dragging && can_drag_camera) {
      moveCamera(e.movementX, e.movementY)
    }
    setMousePos(() => ({ 
      x:e.clientX, 
      y:e.clientY 
    }))
  }, [dragging, setMousePos, camera, moveCamera])

  const mouse = {
    x: mousePos.x - camera.x,
    y: mousePos.y - camera.y
  }

  const presnap_mouse = layer ? {
    x: mouse.x < 0 ? mouse.x - layer.snap.x : mouse.x,
    y: mouse.y < 0 ? mouse.y - layer.snap.y : mouse.y
  } : { ...mouse }

  const snapped_mouse = layer ? {
    x: presnap_mouse.x - (presnap_mouse.x % layer.snap.x),
    y: presnap_mouse.y - (presnap_mouse.y % layer.snap.y)
  } : { ...mouse }

  const inactive_alpha = 0.35

  return !(current_map && current_layer) ? null : (
    <div 
      className={bss({ dragging })}
      onMouseDown={e => {
        setFocused(true)
        if (e.buttons === 1 && !pathMode && !draggingNode)
          onPlace(snapped_mouse.x, snapped_mouse.y)
      }}
      onMouseOver={e => {
        setFocused(true)
        if (e.buttons === 1 && !pathMode)
          onPlace(snapped_mouse.x, snapped_mouse.y)
      }}
      onMouseOut={() => {
        setFocused(false)
      }}
    >
      <Stage 
        width={width} 
        height={height}
        options={{
          backgroundColor: 0xEEEEEE,
        }}
      >
        <PointerLock enabled={lockPointer} />
        {/* grid */}
        <Container>
          <Graphics draw={drawGrid} />
        </Container>
        {/* layers */}
        <Container
          x={camera.x}
          y={camera.y}
        >
          {Object.keys(maps[current_map].tiles || [])
            .sort((a, b) => getItem(a).z - getItem(b).z)
            .map(id => (
              <Container 
                key={id} 
                alpha={current_layer === id ? 1 : inactive_alpha}
              >
                {maps[current_map].tiles[id].map(tile => (
                  <Tile 
                    {...tile} 
                    key={tile.key}
                    disabled={current_layer !== id} 
                    onDelete={() => deleteTile(tile.id, tile.key)}
                  />
                ))}
              </Container>
            ))}
            {Object.keys(maps[current_map].nodes || [])
              .sort((a, b) => getItem(a).z - getItem(b).z)
              .map(id => (
                <Container 
                  key={`layer-${id}`} 
                  alpha={current_layer === id ? 1 : inactive_alpha}
                >
                  {maps[current_map].nodes[id]
                  .sort((a, b) => {
                    if (!selectedItem || selectedItem.type !== "node")
                      return 0
                    else if (selectedItem.id === b.id) 
                      return -1
                    else if (selectedItem.id === a.id) 
                      return 1
                    return 0
                  })
                  .map((node)=> (
                    <Node 
                      {...node}
                      canvasKey={node.key}
                      canvas={canvas}
                      sidebar={sidebar}
                      item={getItem(node.id)}
                      size={Math.max(6, getItem(node.id).connect_type === "none" ? layer.snap.x : 6)}
                      key={node.key}
                      disabled={current_layer !== id} 
                      selected={selectedItem && selectedItem.id === node.id}
                      editing={selectedItem && pathMode && node.id === selectedItem.id}
                      onEdgeClick={(start, end) => toggleNodeEdge(node, start, end)}
                      onPointDelete={(i) => {
                        deleteNodePoint(node, i)
                      }}
                      onDelete={() => deleteNode(node.key)}
                    />
                  ))}
                  {node_parts.length > 0 && selectedItem && (
                    <Node
                      key={`incomplete-${selectedItem.id}`}
                      canvasKey={`incomplete-${selectedItem.id}`}
                      canvas={canvas}
                      sidebar={sidebar}
                      id={selectedItem.id}
                      item={selectedItem}
                      node={{
                        edges:[],
                        points: node_parts
                      }}
                      selected={true}
                      size={Math.max(6, selectedItem.connect_type === "none" ? layer.snap.y : 6)}
                      incomplete
                      editing={false}
                      x={0}
                      y={0}
                      onEdgeClick={(start, end) => console.log(start, end)}
                      onPointDelete={() => deleteNodePoint()}
                      onDelete={() => null}
                    />
                  )}
                </Container>
              ))}
        </Container>
        {/* overlay ui */}
        {PIXI.BitmapFont.available["proggy_scene"] && (
          <Container>
            <BitmapText  
              x={mousePos.x + 20}
              y={mousePos.y + 20}
              text={`${snapped_mouse.x}, ${snapped_mouse.y}`}
              style={{ fontName: "proggy_scene", fontSize: 16, align: "left" }}
            />
            <BitmapText  
              x={width - 10}
              y={height - 10}
              alpha={0.5}
              text={[
                // selected item 
                !selectedItem || !["node", "label", "tileset"].includes(selectedItem.type) ? '' :
                `${selectedItem.name}${pathMode && selectedItem.connect_type !== "none" ? ".edges" : ''}`,
                // map.layer
                `${getItem(current_map).name}.${getItem(current_layer).name}`
              ].join('\n')}
              style={{ fontName: "proggy_scene", fontSize: 32, align: "right" }}
              anchor={[1, 1]}
            />
          </Container>
        )}
      </Stage>
    </div>
  )
}