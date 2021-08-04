import { ComponentProps, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { bem, Form, useWindowSize, ObjectAny, ObjectGet, FC, useEvent, useTheme, cx, css, css_popbox, Button } from "ts/ui"
import { useGlobalCtx } from "ts/globalcontext"
import * as PIXI from "pixi.js"
import { Stage, Container, Graphics, BitmapText, Sprite, useApp } from "@inlet/react-pixi"
import { useSaveCtx } from "ts/savecontext"
import { useProject } from "ts/project"
import { ItemOptions, useSidebarCtx } from "ts/sidebar"
import { nanoid } from 'nanoid'
import { LabelBody } from "ts/types/label"

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
PIXI.settings.ROUND_PIXELS = true

type ElementType = "nodes"|"tiles"
type TileCropInfo = { path:string, x:number, y:number, w:number, h:number }
type NodeInfo = { points:Point[], edges:Edge[], label?:string }

type Edge = [Point, Point, string?]
type Point = { x:number, y:number, label?:{
  [key:string]:any,
  _id:string
} }

export type Map = {
  [key:string]:any,
  camera: Point,
  tiles?:ObjectAny<ITile[]>,
  nodes?:ObjectAny<INode[]>
}

type CanvasGlobalCtx = {
  tiles: TileCropInfo[],
  node_parts: Point[],
  selectedNode: string,
  draggingNode: boolean,
  editLabel: {
    canvasKey: string,
    node: NodeInfo,
    point: number,
    label: Partial<LabelBody>
  }
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
const containsPoint = (edge:Edge, point:Point) => (
  (edge[0].x === point.x && edge[0].y === point.y) || 
  (edge[1].x === point.x && edge[1].y === point.y)
)
const pointEquals = (pt1:Point, pt2:Point) => (
  pt1.x === pt2.x && pt1.y === pt2.y 
)
const edgeKey = (edge:Edge) => `${edge[0].x},${edge[0].y},${edge[1].x},${edge[1].y}`

const lineStyle = {
  join: PIXI.LINE_JOIN.ROUND
}

const bss = bem("canvas")

export const useCanvasCtx = () => {
  const { saveHistory } = useProject()
  const { data:{ tiles, node_parts, selectedNode, draggingNode, editLabel }, update:updateGlobal } = useGlobalCtx<CanvasGlobalCtx>("canvas", { 
    tiles:[], 
    node_parts:[],
    selectedNode: "",
    draggingNode: false,
    editLabel: null
  })
  const { data:{ maps = {}, current_layer, current_map }, update } = useSaveCtx<CanvasCtx>("canvas")
  const { selectedItem, getItem } = useSidebarCtx()

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

  const setEditLabel = useCallback((canvasKey?:string, node?:NodeInfo, point?:number, labelid?:string) => {
    updateGlobal({
      editLabel: canvasKey ? { canvasKey, node, point, label:getItem(labelid) } : null
    })
  }, [updateGlobal, getItem])

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
    update({ current_layer: id || current_layer})     
  }, [current_layer, update])

  const setLayer = useCallback((id:string) => {
    update({ current_layer: id })
  }, [update])

  const addMap = useCallback((id:string) => {
    update({ 
      maps:{ 
        ...maps, 
        [id]:{ 
          camera: {x:0, y:0}
        } 
      },
      current_map: id || current_map
    })      
  }, [maps, current_map, update])

  const removeLayer = useCallback((id:string) => {
    let new_current_layer:string = null
    update(prev_maps => ({
      maps:Object.keys(prev_maps.maps).reduce((new_maps, mapid) => ({
        ...new_maps,
        [mapid]: Object.keys(prev_maps.maps[mapid]).reduce((new_map, type) => {
          Object.keys(prev_maps.maps[mapid][type]).forEach(lid => {
            if (lid !== id)
              new_current_layer = lid
          })
          return {
            ...new_map,
            [type]: {
              ...prev_maps.maps[mapid][type],
              [id]: undefined
            }
          }
        }, { ...prev_maps.maps[mapid] })
      }), { ...prev_maps.maps }),
      current_layer: prev_maps.current_layer === id ? new_current_layer : prev_maps.current_layer
    }))
  }, [update])
  
  const removeMap = useCallback((id:string) => {
    update({
      maps: { ...maps, [id]:undefined },
      current_map: current_map === id ? null : current_map
    })
  }, [maps, update, current_map])

  const removeElement = useCallback((id:string, type:"tiles"|"nodes") => {
    update(prev_maps => ({
      ...prev_maps,
      maps: Object.keys(prev_maps.maps).reduce((new_maps, mapid) => ({
        ...new_maps,
        [mapid]: {
          ...prev_maps.maps[mapid],
          [type]: Object.keys(prev_maps.maps[mapid][type]).reduce((new_layer, layerid) => {
            const elements = prev_maps.maps[mapid][type][layerid] as (INode|ITile)[]
            return {
              ...new_layer,
              [layerid]: elements.filter(val => val.key !== id)
            }
          }, { ...prev_maps.maps[mapid][type] as ObjectAny<(INode|ITile)[]> })
        }
      }), { ...prev_maps.maps })
    }))
  }, [update])

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

  useEvent("sidebar.item.delete", (e:CustomEventInit) => {
    switch (e.detail.type) {
      case "layer":
        return removeLayer(e.detail.id)
      case "node":
        return removeElement(e.detail.id, "nodes")
      case "tile":
        return removeElement(e.detail.id, "tiles")
      case "map":
        return removeMap(e.detail.id)
    }
  }, [removeElement, removeMap, removeLayer])

  useEvent("sidebar.item.add", (e:CustomEventInit) => {
    console.log(e.detail)
    switch (e.detail.type) {
      case "layer": 
        return addLayer(e.detail.id)
      case "map": 
        return addMap(e.detail.id)
    }
  }, [addMap, addLayer])

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
    camera: maps[current_map] ? maps[current_map].camera : { x:0, y:0 },
    node_parts,
    selectedNode,
    draggingNode,
    editLabel,
    setEditLabel,
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
  key?:string,
  canvasKey?:string,
  id?:string,
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
      pointerover={e => {
        if (!e.data.originalEvent.altKey && e.data.buttons === 2) {
          onDelete(e)
        }
      }}
      pointerdown={e => {
        if (!e.data.originalEvent.altKey && e.data.buttons === 2) {
          onDelete(e)
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
  const { getItem, selectItem, selectedItem } = sidebar
  const { 
    camera, current_layer, selectedNode,  
    selectMapNode, updateNode, setDraggingNode, setEditLabel
  } = canvas
  const [dragging, setDragging] = useState(-1)
  const [hoveringPoint, setHoveringPoint] = useState<ObjectAny>({})
  
  const extra_hit = size < 10 ? 10 : size
  const can_select_map_node = item.connect_type !== "none"
  const layer = getItem(current_layer)

  // TODO: efficiency needed? only updateNode on mouseup
  useEvent("mousemove", (e:MouseEvent) => {
    if (dragging > -1 && layer) {
      const [x,y] = [e.clientX - camera.x, e.clientY - camera.y]
      const new_point = layer ? {
        x: x - (x % layer.snap.x),
        y: y - (y % layer.snap.y)
      } : {
        x, y
      }
      const old_point = points[dragging]
      const can_move_point = points.filter(p => pointEquals(p, new_point)).length === 0
      
      updateNode(canvasKey, {
        node: {
          ...node,
          edges: !can_move_point ? nodeEdges : nodeEdges.map((edge) => {
            if (containsPoint(edge, old_point)) {
              if (pointEquals(edge[0], old_point))
                return [new_point, edge[1]]
              if (pointEquals(edge[1], old_point))
                return [edge[0], new_point]
            }
            return edge 
          }),
          points: points.map((pt, i) => {
            if (i === dragging && can_move_point) {
              return new_point
            }
            return pt
          })
        }
      })
    }
  }, [dragging, updateNode, layer, canvasKey, points, nodeEdges])

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

  const getHoverPointEvents = useCallback((i:number) => ({
    pointerover: () => {
      setHoveringPoint({
        ...hoveringPoint,
        [i]:true
      })
    },
    pointerout: () => {
      setHoveringPoint({
        ...hoveringPoint,
        [i]:false
      })
    }
  }), [setHoveringPoint, hoveringPoint])

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
              e.stopPropagation()
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
      {points.map((point, i) => [
        <Graphics
          key={`${point.x},${point.y},${i}`}
          x={item.connect_type === "none" ? point.x : point.x - (size/2)}
          y={item.connect_type === "none" ? point.y : point.y - (size/2)}
          interactive={true}
          hitArea={new PIXI.Rectangle(0, 0, extra_hit, extra_hit)}
          {...getHoverPointEvents(i)}
          pointerdown={e => {
            if (!e.data.originalEvent.altKey && e.data.button === 2) {
              // delete this point
              if (!selectedItem || selectedItem.type === "node") {
                if (points.length > 1)
                  onPointDelete(i)
                else 
                  onDelete(e)
              }
              // remove the label 
              else if (selectedItem.type === "label") {
                updateNode(canvasKey, {
                  node: {
                    ...node,
                    points: points.map((pt, j) => {
                      if (j === i)
                        return { ...pt, label: undefined }
                      return pt
                    })
                  }
                })
              }
            }
            if (e.data.originalEvent.ctrlKey && e.data.button === 0 && can_select_map_node) {
              selectMapNode(canvasKey)
              selectItem(id, true)
            }
            if (e.data.button === 0) {
              // start dragging node
              if (!selectedItem || selectedItem.type === "node") {
                setDraggingNode(true)
                setDragging(i)
              }
              // add label 
              else if (selectedItem.type === "label") {
                const label_data:Point["label"] = { _id: selectedItem.id }
                selectedItem.field_ids.forEach((id:string) => {
                  label_data[id] = null
                })
                updateNode(canvasKey, {
                  node: {
                    ...node,
                    points: points.map((pt, j) => {
                      if (j === i)
                        return { ...pt, label: label_data }
                      return pt
                    })
                  }
                })
              }
            }
          }}
          draw={drawPoint}
        />,
        point.label && (
          <Text
            key={`${point.x},${point.y},${i},text`}
            x={item.connect_type === "none" ? point.x + (size/2) : point.x}
            y={item.connect_type === "none" ? point.y + size : point.y + (size/2)}
            text={Object.values(point.label).length <= 1 || !hoveringPoint[i]  ? "..." : Object.entries(point.label).filter(([k]) => k !== "_id").map(([_,v]) => {
              return v
            }).join('\n')}
            style={{ fontName: "proggy_scene", fontSize: 16, align: "left" }}
            anchor={[0.5,0]}
            interactive={true}
            {...getHoverPointEvents(i)}
            pointerdown={e => {
              if (!e.data.originalEvent.altKey && e.data.button === 0) {
                // open label editor
                setEditLabel(canvasKey, node, i, point.label._id)
              }
            }}
          />
        )
      ])}
      {points.length > 0 && (
        <Text
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

interface IText extends ICanvasElement {}

const Text:FC<IText & ComponentProps<typeof BitmapText>> = ({ ...props }) => {

  useEffect(() => {
    if (!PIXI.BitmapFont.available["proggy_scene"])
      PIXI.BitmapFont.from("proggy_scene", {
        fontFamily: "ProggySquare",
        fontSize: 16,
        fill: 0xFAFAFA,
        stroke: 0x212121,
        strokeThickness: 2
      }, {
        chars: PIXI.BitmapFont.ASCII
      })
  }, [PIXI.BitmapFont.available])

  return PIXI.BitmapFont.available["proggy_scene"] ? (
    <BitmapText 
      {...props}
      style={{ ...props.style, fontName: "proggy_scene" }}
    />
  ) : null
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

export const Canvas = () => {
  const [width, height] = useWindowSize()
  const [dragging, setDragging] = useState<Point>()
  const [lockPointer, setLockPointer] = useState(false)
  const canvas = useCanvasCtx()
  const { 
    camera:mapCamera, setCamera:setMapCamera, 
    current_layer, maps, current_map, node_parts, draggingNode,
    editLabel, 
    onPlace, deleteTile, finishNode, resetNodePath, deleteNode, deleteNodePoint, toggleNodeEdge,
    selectMapNode, updateNode, getNode, setEditLabel
  } = canvas
  const [_, setFocused] = useState(false)
  const [mousePos, setMousePos] = useState({x:0, y:0})
  const sidebar = useSidebarCtx()
  const { getItem, selectedItem } = sidebar
  const [pathMode, setPathMode] = useState(false)
  const [lastMap, setLastMap] = useState("")
  const theme = useTheme()

  const can_drag_camera = maps && current_map
  const map = getItem(current_map)
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
    if (grid && layer) {
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
  }, [width, height, layer, camera, layer])

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

  const getLayer = (type:string) => (Object.keys(maps[current_map][type] || []) as string[])
    .filter(lid => !!getItem(lid))
    .sort((a, b) => getItem(a).z - getItem(b).z)

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

  const inactive_alpha = 0.3

  return !(map && layer) ? null : (
    <div 
      className={bss({ dragging })}
      onMouseDown={() => {
        setFocused(true)
      }}
      onMouseOver={() => {
        setFocused(true)
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
        onPointerDown={e => {
          if (e.buttons === 1 && !pathMode && !draggingNode)
            onPlace(snapped_mouse.x, snapped_mouse.y)
        }}
        onPointerMove={e => {
          if (e.buttons === 1 && !pathMode && !draggingNode)
            onPlace(snapped_mouse.x, snapped_mouse.y)
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
          {getLayer("tiles")
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
          {getLayer("nodes")
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
                .filter(node => getItem(node.id))
                .map((node)=> (
                  <Node 
                    {...node}
                    canvasKey={node.key}
                    canvas={{ ...canvas, camera }}
                    sidebar={sidebar}
                    item={getItem(node.id)}
                    size={Math.max(6, getItem(node.id).connect_type === "none" ? layer.snap.x : 6)}
                    key={node.key}
                    disabled={current_layer !== id} 
                    selected={selectedItem && selectedItem.id === node.id}
                    editing={selectedItem && pathMode && node.id === selectedItem.id}
                    onEdgeClick={(start, end) => toggleNodeEdge(node, start, end)}
                    onPointDelete={(i) => deleteNodePoint(node, i)}
                    onDelete={() => deleteNode(node.key)}
                  />
                ))}
                {node_parts.length > 0 && selectedItem && (
                  <Node
                    key={`incomplete-${selectedItem.id}`}
                    canvasKey={`incomplete-${selectedItem.id}`}
                    canvas={{ ...canvas, camera }}
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
        <Container>
          <Text  
            key="info"
            x={width - 10}
            y={height - 10}
            alpha={0.5}
            text={[
              // selected item 
              !selectedItem || !["node", "label", "tileset"].includes(selectedItem.type) ? '' :
              `${selectedItem.name}${pathMode && selectedItem.connect_type !== "none" ? ".edges" : ''}`,
              // map.layer
              `${map.name}.${layer.name}`
            ].join('\n')}
            style={{ fontName: "proggy_scene", fontSize: 32, align: "right" }}
            anchor={[1, 1]}
          />
          <Text  
            key="coords"
            x={mousePos.x + 20}
            y={mousePos.y + 20}
            text={`${snapped_mouse.x}, ${snapped_mouse.y}`}
            style={{ fontName: "proggy_scene", fontSize: 16, align: "left" }}
          />
        </Container>
      </Stage>
      {editLabel && (
        <div
          className={cx(bss("label-editor"), css_popbox(theme.color.type.node), css`
            top: ${editLabel.node.points[editLabel.point].y + (layer.snap.y / 2) + camera.y}px;
            left: ${editLabel.node.points[editLabel.point].x + (layer.snap.x / 2) + camera.x}px;
          `)}
          onBlur={() => setEditLabel()}
        >
          <div
            className={bss("label-editor-header")}
          >
            <div>{editLabel.label.name}</div>
            <Button 
              icon="x"
              onClick={() => setEditLabel()}
            />
          </div>
          <Form
            order={editLabel.label.field_ids}
            defaultValue={editLabel.label.field_ids.reduce((obj, field) => {
              return {
                ...obj,
                [field]: editLabel.node.points[editLabel.point].label[field]
              }
            }, {})}
            options={editLabel.label.field_ids.reduce((obj, field) => {
              return {
                ...obj,
                [field]: {
                  label: editLabel.label.fields.find(f => f.id === field).name,
                  type: editLabel.label.fields.find(f => f.id === field).type
                }
              }
            }, {})}
            onChange={(e, name) => {
              const inode = getNode(editLabel.canvasKey, current_map, current_layer)
              const ilabel = getItem(editLabel.label.id) as LabelBody
              const label_type = ilabel.fields.find(f => f.id === name).type

              console.log(ilabel, label_type)
              
              updateNode(editLabel.canvasKey, {
                ...inode,
                node: {
                  ...inode.node,
                  points: inode.node.points.map((pt, p) => {
                    if (p === editLabel.point)
                      return { 
                        ...pt, 
                        label:{ 
                          ...inode.node.points[p].label, 
                          [name]: 
                            label_type === "number" ? e.target.valueAsNumber || null : 
                            label_type === "array" ? e.target.value.split(',').map(v => v.trim()) : 
                            e.target.value
                        } 
                      }
                    return pt
                  })
                }
              })
            }}
          />
        </div>
      )}
    </div>
  )
}