// import { useCallback, useEffect, useState } from "react"
import { bem, Input } from "ts/ui"
import { FCItemBody } from "ts/sidebar"

const bss = bem("layer")

export const Layer: FCItemBody = ({ id, name, z, updateItem }) => {
  return (
    <div className={bss()}>
      <Input
        inputClassName={bss("name-input")}
        label="Name"
        type="text" 
        name="name" 
        defaultValue={name}
        onChange={e => updateItem(id, { name:e.target.value })} 
      />
      <Input
        inputClassName={bss("z-input")}
        label="Z"
        type="number" 
        name="z" 
        defaultValue={z}
        onChange={e => updateItem(id, { z:e.target.valueAsNumber })} 
      />
    </div>
  )
}