import { MouseEvent, useCallback, useEffect, useState } from "react"
import { FC, HTMLDiv, cx, css, bem, Button, Icon, Electron, useTheme, capitalize, css_popbox } from "ts/ui"
import { nanoid } from 'nanoid'
import tinycolor from "tinycolor2"
import { useProject } from "ts/project"

export type ItemOptions = {
  id?:string,
  type?:string,
  name?:string,
  _images?:string[],
  [key:string]:any
}

interface IItemBody extends ItemOptions {
  updateItem?: (id:string, data:ItemOptions) => void,
  setImages?: (id:string, images:string[]) => void
}

export interface FCItemBody extends FC<IItemBody> { }

interface IItem extends ItemOptions, HTMLDiv {
  isChild?:boolean,
  onItemClick?: (e:MouseEvent, item:ItemOptions) => void
}


const bss = bem("sidebar")

const Item: FC<IItem> = ({ className, id, name, type, isChild, children, _images, onItemClick, ...props }) => {
  const [expanded, setExpanded] = useState(false)
  const theme = useTheme()

  const type_color = theme.color.type[type.toLowerCase()]
  const shadow_color = tinycolor(type_color).darken(25).toHexString()

  return (
    <div 
      className={cx(css_popbox(type_color, 3, !expanded), bss("item", { expanded }), className)}
        {...props}
    >
      <div 
        className={cx(bss("item-header"))} 
        onContextMenu={() => Electron.menu([
          { label:"rename" },
          { label:"delete" }
        ])}
        onClick={e => onItemClick(e, {id, name, type, ...props})}
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
      {expanded ? children : null}
    </div>
  )
}

interface ISidebar extends HTMLDiv {
  sort?: { [key:string]: string | ((a:ItemOptions, b:ItemOptions) => boolean) },
  body?: { [key:string]: FCItemBody },
  defaultItem?: { [key:string]: any },
  onItemClick?: IItem["onItemClick"]
}

export const Sidebar = ({ className, body, defaultItem, onItemClick, ...props }:ISidebar) => {
  const theme = useTheme()
  const [types, setTypes] = useState<string[]>([])
  const [items, setItems] = useState<ItemOptions[]>([])
  const { isOpen } = useProject()

  const addItem = useCallback((opts:ItemOptions) => {
    const type_lower = opts.type.toLowerCase()
    let num = 0
    while (items.some(i => i.name === `${opts.type}${num}`))
      num++
    setItems([
      ...items,
      { 
        id:nanoid(), 
        type:type_lower, 
        name:`${opts.type}${num}`,
        ...defaultItem[type_lower]
      }
    ])
  }, [items, defaultItem])

  const showAddMenu = useCallback(() => {
    Electron.menu(types.map(type => ({
      label: type,
      click: () => addItem({ type })
    })))
  }, [types, addItem])

  const updateItem = useCallback((id, data:ItemOptions) => 
    setItems(
      items.map(i => id === i.id ? {...i, ...data} : i )
    )
  , [items, setItems])

  const setImages = useCallback((id, images:string|string[]) =>
    updateItem(id, { _images:[].concat(images) })
  , [updateItem])

  useEffect(() => {
    setTypes(Object.keys(theme.color.type).map(capitalize))
  }, [theme])

  return (
    <div className={cx(bss(), className)} {...props}>
      <div className={bss("items")}>
        {items.map(item => {
          const ItemBody = body[item.type]
          return (
            <Item {...item} key={item.id} onItemClick={onItemClick}>
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