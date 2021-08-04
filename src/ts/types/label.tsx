// import { useCallback, useEffect, useState } from "react"
import { bem, Form, Button, FormOptions, ObjectAny } from "ts/ui"
import { FCItemBody, IItemBody } from "ts/sidebar"
import { nanoid } from 'nanoid'

const bss = bem("label")

type LabelField = {
  name: string,
  type: "number" | "text" | "checkbox" | "array",
  id: string
}

export interface LabelBody extends IItemBody {
  fields: LabelField[],
  field_ids: string[]
}

export const Label: FCItemBody<LabelBody> = ({ id, name, fields=[], field_ids=[], updateItem }) => {
  const options:FormOptions = {}
  const fields_default:ObjectAny = {}

  if (fields.length > 0) {
    fields.forEach(f => {
      options[f.id] = {
        label: false,
        columns: 3,
        names: ["name", "type", "remove"],
        options: {
          name: {
            type: "text"
          },
          type: {
            type: "select",
            values: ["number", "text", "checkbox", "array"]
          },
          remove: {
            type: "button",
            icon: 'x',
            onClick: () => {
              updateItem(id, {
                fields: fields.filter(f2 => f2.id !== f.id),
                field_ids: field_ids.filter(fid => fid !== f.id)
              })
            }
          }
        }
      }
   
      fields_default[f.id] = { ...f }
    })
  }

  return (
    <div className={bss()}>
      <Form 
        defaultValue={{ name, ...fields_default }}
        order={[
          "name",
          ...fields.map(f => f.id),
          () => (
            <Button 
              icon="plus"
              title="Add field"
              onClick={() => {
                const new_id = nanoid(4)
                updateItem(id, {
                  fields: [
                    ...fields, 
                    { id:new_id, type: "text" , name: "" }
                  ],
                  field_ids: [ ...field_ids, new_id]
                })
              }}
            />
          )
        ]}
        options={options}
        onChange={(e, name, subname) => {
          switch(name) {
            case "name":
              updateItem(id, { name: e.target.value })
              break
          }
          if (field_ids.includes(name)) {
            updateItem(id, {
              fields: fields.map((field) => field.id !== name ? field : ({
                ...field,
                [subname]: e.target.value
              }))
            })
          }
        }}
      />
    </div>
  )
}