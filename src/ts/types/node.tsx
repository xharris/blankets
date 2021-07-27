import { bem, Form } from "ts/ui"
import { FCItemBody } from "ts/sidebar"

const bss = bem("node")

export const Node: FCItemBody = ({ id, name, connect_type, updateItem }) => {

  return (
    <div className={bss()}>
      <Form 
        defaultValue={{ name, connect_type }}
        order={["name", "connect_type"]}
        options={{
          connect_type: {
            label: "Type",
            type: "select",
            defaultValue: connect_type || "none",
            values: [
              ['none', "none"], 
              ['path', "path"], 
              ['graph', "graph"]
            ]
          }
        }}
        onChange={(e, name) => {
          switch(name) {
            default:
              updateItem( id, { [name]: e.target.value } )
          }
        }}
      />
    </div>
  )
}