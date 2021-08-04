import { bem, Form } from "ts/ui"
import { FCItemBody } from "ts/sidebar"
import { useCanvasCtx } from "ts/canvas"

const bss = bem("map")

export const Map: FCItemBody = ({ id, name, snap, updateItem }) => {
  const {  } = useCanvasCtx()

  return (
    <div className={bss()}>
      <Form 
        defaultValue={{ name, snap }}
        order={["name", "snap"]}
        onChange={(e, name, subname) => {
          let new_val
          switch(name) {
            case "name":
              updateItem(id, { name: e.target.value })
              break
            case "snap": 
              new_val = { snap: { ...snap, [subname]: e.target.valueAsNumber || 0 } }
              updateItem(id, new_val)
              break
          }
        }}
        options={{
          snap: {
            type: "number",
            min: 0,
            names: ['x','y']
          }
        }}
      />
    </div>
  )
}