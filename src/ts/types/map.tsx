import { bem, Form } from "ts/ui"
import { FCItemBody } from "ts/sidebar"
import { useCanvasCtx } from "ts/canvas"

const bss = bem("map")

export const Map: FCItemBody = ({ id, name, updateItem }) => {
  const {  } = useCanvasCtx()

  return (
    <div className={bss()}>
      <Form 
        defaultValue={{ name }}
        order={["name"]}
        onChange={(e, name) => {
          switch(name) {
            case "name":
              updateItem(id, { name: e.target.value })
          }
        }}
      />
    </div>
  )
}