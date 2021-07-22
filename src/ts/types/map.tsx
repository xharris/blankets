import { bem, Form } from "ts/ui"
import { FCItemBody } from "ts/sidebar"

const bss = bem("map")

export const Map: FCItemBody = ({ id, name, updateItem }) => {

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