import React, { MouseEvent, useCallback, useEffect, useState } from "react"
import { FC, HTMLDiv, cx, css, bem, Button, Icon, Electron, useTheme, capitalize, css_popbox, ObjectAny, ValueOf, dispatchEvent } from "ts/ui"
import { nanoid } from 'nanoid'
import tinycolor from "tinycolor2"
import { useProject } from "ts/project"
import { useSaveCtx } from "ts/savecontext"
import { useGlobalCtx } from "./globalcontext"

export type ItemOptions = {
  id?: string,
  type?: string,
  name?: string,
  _images?: string[],
  [key: string]: any
}

export interface IItemBody extends ItemOptions {
  updateItem?: (id: string, data: ItemOptions) => void,
  setImages?: (id: string, images: string[]) => void,
  expanded?: boolean
}

export interface FCItemBody<T=IItemBody> extends FC<T> { 
  updateItem?: (id: string, data: Partial<T>) => void,
}

interface IItem extends ItemOptions, HTMLDiv {
  isChild?: boolean,
  onItemClick?: (e: MouseEvent, item: ItemOptions) => void,
  onItemDelete?: () => void
}


const bss = bem("sidebar")

const Item: FC<IItem> = ({ className, id, name, type, isChild, children, _images, onItemDelete, onItemClick, ...props }) => {
  const [expanded, setExpanded] = useState(false)
  const theme = useTheme()
  const { selectedItem } = useSidebarCtx()

  const type_color = theme.color.type[type.toLowerCase()]
  const shadow_color = tinycolor(type_color).darken(25).toHexString()

  return (
    <div
      className={cx(css_popbox(type_color, 3, !expanded, selectedItem && selectedItem.id === id), bss("item", { expanded }), className)}
      {...props}
    >
      <div
        className={cx(bss("item-header"))}
        onContextMenu={() => Electron.menu([
          {
            label: "delete", click: () => {
              if (window.confirm(`Delete "${name}"?`))
                onItemDelete()
            }
          }
        ])}
        onClick={e => onItemClick(e, { id, name, type, ...props })}
      >
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          className={cx(bss("btn-expand"), css`color:${shadow_color};`)}
          onClick={e => {
            setExpanded(!expanded)
            e.stopPropagation()
          }}
        />
        <span>{name}</span>
        {_images && <div className={bss('images')}>
          {_images.map(i => (
            <div
              key={i}
              className={cx(bss("image"), css`
              background-image: url(file://${i});
            `)}
            />
          ))}
        </div>}
      </div>
      <div className={bss("item-children", { hidden:!expanded })}>
        {React.Children.map(children, child => React.isValidElement(child) ? React.cloneElement(child, { expanded }) : child)}
      </div>
    </div>
  )
}

interface ISidebar extends HTMLDiv {
  sort?: { [key: string]: string | ((a: ItemOptions, b: ItemOptions) => number) },
  noselect?: string[],
  body?: { [key: string]: FCItemBody<any> },
  defaultItem?: { [key: string]: any },
  onItemClick?: IItem["onItemClick"],
  onItemDelete?: (id: string) => void,
  onItemAdd?: (info: ItemOptions) => void
}

type SidebarCtx = {
  items: ItemOptions[]
}

type SidebarGlobalCtx = {
  selectedItem: ItemOptions
}

export const useSidebarCtx = () => {
  const { data:{ selectedItem }, update } = useGlobalCtx<SidebarGlobalCtx>("sidebar", { selectedItem:null })
  const props = useSaveCtx<SidebarCtx>("sidebar", { items:[] })
  const { data:{ items } } = props

  const getItem = useCallback((id:string) => 
    items.find(item => item.id === id)
  ,[items])

  const getItems = useCallback((type:string) =>
    items.filter(item => item.type === type)
  ,[items])

  const selectItem = useCallback((id:string, set?:boolean) =>
    update({
      selectedItem: selectedItem && selectedItem.id === id && !set ? null : items.find(item => item.id === id)
    })
  ,[update, items, selectedItem])

  return {
    ...props,
    selectedItem,
    selectItem,
    getItem,
    getItems
  }
}

export const Sidebar = ({ className, body, defaultItem, onItemClick, sort, noselect=[], onItemAdd, onItemDelete, ...props }: ISidebar) => {
  const theme = useTheme()
  // const [items, setItems] = useState<ItemOptions[]>([])
  const { isOpen, loading } = useProject()
  const [itemsDirty, setItemsDirty] = useState(true)
  const { data:{ items }, selectedItem, update, selectItem } = useSidebarCtx()
  const { saveHistory } = useProject()
  const types = Object.keys(theme.color.type)

  const sortItems = useCallback((itemlist: ItemOptions[]) => {
    if (sort) {
      const sort_keys:ObjectAny<ValueOf<typeof sort>> = {}
      types.forEach(type => { sort_keys[type] = sort[type] || "name" })
      itemlist.sort((a, b) => {
        const key = sort_keys[a.type]
        // use custom key sort
        if (a.type === b.type) {
          if (typeof key === "function")
            return key(a, b)
          return a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0
        }
        // keep different types together
        if (a.type.toLowerCase() < b.type.toLowerCase())
          return -1 
        if (a.type.toLowerCase() > b.type.toLowerCase())
          return 1 
        return 0
      })
    }
    return itemlist
  }, [sort, types])

  const addItem = useCallback((opts: ItemOptions) => {
    const type_lower = opts.type.toLowerCase()
    let num = 0
    while (items.some(i => i.name === `${opts.type}${num}`))
      num++
    const new_item:ItemOptions = {
      id: nanoid(),
      type: type_lower,
      name: `${opts.type}${num}`,
      ...defaultItem[type_lower]
    }
    update({ items: [ ...items, new_item ] })
    saveHistory()
    setItemsDirty(true)
    if (onItemAdd)
      onItemAdd({...new_item})
    return new_item
  }, [items, defaultItem, onItemAdd, update, setItemsDirty, saveHistory])

  const showAddMenu = useCallback(() => {
    Electron.menu(types.map(type => ({
      label: capitalize(type),
      click: () => {
        const new_item = addItem({ type })
        dispatchEvent("sidebar.item.add", { detail: { type:new_item.type, id:new_item.id } })
      }
    })))
  }, [types, addItem])

  const updateItem = useCallback((id, data: ItemOptions) => {
    update({ items: items.map(i => id === i.id ? { ...i, ...data } : i) })
    saveHistory()
    setItemsDirty(true)
  }, [items, update, setItemsDirty, saveHistory])

  const setImages = useCallback((id, images: string | string[]) =>
    updateItem(id, { _images: [].concat(images) })
    , [updateItem])

  useEffect(() => {
    if (itemsDirty && !loading) {
      update({ items: sortItems(items) })    
      setItemsDirty(false)
    }
  }, [items, sortItems, update, setItemsDirty, itemsDirty, isOpen, loading])

  useEffect(() => {
    setItemsDirty(true)
  }, [setItemsDirty, loading])

  return (
    <div className={cx(bss(), className)} {...props}>
      <div className={bss("items")}>
        {items.map(item => {
          const ItemBody = body[item.type]
          return (
            <Item
              {...item}
              key={item.id}
              onItemClick={(e, item) => {
                if (onItemClick) onItemClick(e, item)
                if (!noselect.includes(item.type) || (selectedItem && selectedItem.id === item.id))
                  selectItem(item.id)
              }}
              onItemDelete={() => {
                if (onItemDelete)
                  onItemDelete(item.id)
                update({ items:items.filter(i => i.id !== item.id) })
                dispatchEvent("sidebar.item.delete", { detail: { type:item.type, id:item.id } })
                setItemsDirty(true)
                saveHistory()
              }}
            >
              {ItemBody && <ItemBody {...item}
                updateItem={updateItem}
                setImages={setImages}
              />}
            </Item>
          )
        })}
      </div>
      <div className={bss("controls")}>
        {isOpen && <Button icon="plus" onClick={() => showAddMenu()} />}
      </div>
    </div>
  )
}