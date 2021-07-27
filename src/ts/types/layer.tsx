// import { useCallback, useEffect, useState } from "react"
import { bem, Form } from "ts/ui"
import { FCItemBody, IItemBody } from "ts/sidebar"

const bss = bem("layer")

interface LayerBody extends IItemBody {
  snap: { x:number, y:number },
  offset: { x:number, y:number }
}

export const Layer: FCItemBody<LayerBody> = ({ id, name, z, snap, offset, updateItem }) => {
  return (
    <div className={bss()}>
      <Form 
        defaultValue={{ name, z, snap, offset }}
        order={["name", "z", "snap", "offset"]}
        onChange={(e, name, subname) => {
          let new_val
          switch(name) {
            case "name":
              updateItem(id, { name: e.target.value })
              break
            case "z":
              new_val = { z: e.target.valueAsNumber || 0 }
              updateItem(id, new_val)
              break
            case "snap": 
              new_val = { snap: { ...snap, [subname]: e.target.valueAsNumber || 0 } }
              updateItem(id, new_val)
              break
            case "offset":
              new_val = { offset: { ...offset, [subname]: e.target.valueAsNumber || 0 } }
              updateItem(id, new_val)
              break
          }
        }}
        options={{
          z: {
            type: "number"
          },
          snap: {
            type: "number",
            min: 0,
            names: ['x','y']
          },
          offset: {
            type: "number", 
            names: ['x','y']
          }
        }}
      />
    </div>
  )
}