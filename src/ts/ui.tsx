import { css, cx } from "@emotion/css"
import * as FIcon from "react-feather"
import { dialog, Menu, getCurrentWindow, require as remoteRequire } from "@electron/remote"
import React, { FunctionComponent, HTMLAttributes, createContext, useContext, InputHTMLAttributes, FormHTMLAttributes, useState, useEffect, DependencyList, useCallback, useLayoutEffect } from "react"
import tinycolor from "tinycolor2"
import { basename } from "path"

// CSS / Styling 

type BemBlockModifiers = { [key: string]: any; }
type BemBlockFn = (element?: string | BemBlockModifiers, modifiers?: BemBlockModifiers, excludeRoot?: boolean) => string

interface IThemeProps {
  color: {
    fg: string,
    bg: string,
    type: ObjectAny<string>
  }
}

const theme_default = {
  color: {
    fg: "#FDD835",
    bg: "#FAFAFA",
    type: {}
  }
}
const ThemeContext = createContext({
  ...theme_default
})
export const ThemeProvider = (props: React.ProviderProps<IThemeProps>) => <ThemeContext.Provider value={{ ...theme_default }} {...props} />
export const useTheme = (): IThemeProps => useContext(ThemeContext)

export const bem = (block?: string): BemBlockFn => {
  return (element?: string | BemBlockModifiers, modifiers?: BemBlockModifiers, excludeRoot?: boolean): string => {
    if (typeof element !== "string") {
      modifiers = element
      element = null
    }
    const classes = [
      !element || element === block ? block : `${block}__${element}`,
      ...(modifiers
        ? Object.keys(modifiers).map((m) => {
          if (typeof modifiers[m] === "boolean") {
            return (modifiers[m] === true) ? (element ? `${block}__${element}--${m}` : `${block}--${m}`) : null
          } else return element ? `${block}__${element}--${m}-${modifiers[m]}` : `${block}--${m}-${modifiers[m]}`
        }).filter(m => m)
        : []),
    ]
    if (excludeRoot)
      classes.splice(0, 1)
    return cx(...classes)
  }
}

export const pickBgColor = (fg: tinycolor.ColorInput, amount?: number) => {
  const fg_color = tinycolor(fg)
  return fg_color.isLight() ? fg_color.darken(amount) : fg_color.brighten(amount)
}

export const css_popbox = (color:string, thickness=2, only_hover=false) => {
  const boxShadow = (c:string) => new Array(thickness).fill(0).map((_, i) => `${i}px ${i}px ${c}`).join(', ')
  const shadow_color = tinycolor(color).darken(25).toHexString()
  // const shadow = tinycolor(color).lighten(20).toHexString()
  const bg_color = tinycolor(color).brighten(10).toHexString()
  const text_color = tinycolor(color).isDark() ? tinycolor(color).brighten(50).toHexString() : tinycolor(color).darken(25).toHexString()
  return css`
    color: ${text_color};
    background-color: ${bg_color};
    border: ${Math.max(0, thickness-2)}px solid transparent;
    border-radius: ${thickness}px;
    margin-right: ${thickness-1}px;
    // box-sizing: border-box;
    box-shadow: ${thickness}px ${thickness}px 2px rgba(0, 0, 0, 0.2);

    ${only_hover ? '&:hover' : '&'} {
      box-shadow: ${thickness}px ${thickness}px 2px ${tinycolor(shadow_color).setAlpha(0.5).toRgbString()}; // ${boxShadow(shadow_color)} ;
      // border-color: ${color};
    }
  `
}

// HTML

export type FC<P> = FunctionComponent<P>
export type HTMLDiv = HTMLAttributes<HTMLDivElement>

interface IIcon extends HTMLAttributes<HTMLImageElement> {
  name: string,
  color?: string
}
const bss_icon = bem("uiicon")
export const Icon: FC<IIcon> = ({ className, name, color, ...props }) => {
  const IconElement = (FIcon as { [key: string]: FIcon.Icon })[
    name
      .split('-')
      .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  ]
  return <IconElement
    className={cx(bss_icon(), css(`color:${color || "#212121"};`), className)}
    {...props as FIcon.Icon}
  />
}

interface IButton extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string,
  icon?: string,
  color?: string
}
const bss_button = bem("uibutton")
export const Button: FC<IButton> = ({ className, text, icon, color = "#212121", type="button", ...props }) =>
(
  <button 
    className={cx(bss_button(), css(`
      &:hover:enabled {
        &, > * {
          color: ${tinycolor(color).isDark() ? "#FAFAFA" : "#212121"}
        }
        background-color: ${color}
      }
    `), className)} 
    type={type}
    {...props}
  >
    {icon ? <Icon name={icon} color={color} /> : null}
    {text}
  </button>
)

interface IInput extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | boolean,
  inputClassName?: string,
  chooseFileOptions?:chooseFileOptions,
  onFile?: (v:Electron.OpenDialogReturnValue) => any,
  onError?: (...args:any[]) => void,
  icon?: string,
  values?: [string, string][] | string[] | string[][]
}
const bss_input = bem("uiinput")
export const Input: FC<IInput> = ({ 
  className, 
  inputClassName, 
  label, 
  width, 
  title, 
  type, 
  chooseFileOptions, 
  onFile = () => {},
  onError,
  icon,
  values,
  defaultValue,
  ...props 
}) => {
  const [value, setValue] = useState<string[]>([].concat(defaultValue).filter(p => p))
  
  return type === "button" ? <Button icon={icon} {...props} /> : (
    <label
      className={cx(bss_input({ labeled: !!label }), className)}
      title={title}
    >
      {label}
      {type === "file" ? 
        <Button
          className={cx(bss_input("file-input"), inputClassName)}
          text={value.length > 0 ? value.map(p => basename(p)).join(', ') : "Choose file..."}
          icon={icon || "file"}
          onClick={() => 
            Electron.chooseFile(chooseFileOptions)
              .then(result => {
                setValue(result.filePaths)
                return onFile(result)
              })
              .catch(onError)
          }
        />
      : type === "select" ?
        <select
          className={cx(bss_input("select-input"), inputClassName)}
          {...(props as unknown as React.SelectHTMLAttributes<HTMLSelectElement>)}
          value={defaultValue || "_DEFAULT_"}
          title={(title || defaultValue || "").toString()}
        >
          <option key="_default" value="_DEFAULT_" disabled hidden>{props.placeholder || "..."}</option>
          {values.map(v => {
            const value = Array.isArray(v) ? v[0] : v 
            const label = Array.isArray(v) ? v[1] : v
            return <option key={value} value={value}>{label}</option>
          })}
        </select>
      :
        <input
          className={cx(bss_input("input"), inputClassName)}
          type={type}
          defaultValue={defaultValue}
          {...props}
        />
      }
    </label>
  )
}

type FormCustomRender = () => {}

export type FormOptions = ObjectAny<FormOption>

interface FormOption extends IInput {
  columns?: number,
  names?: string[],
  options?: {[key:string]:FormOption}
}

type IForm = Omit<FormHTMLAttributes<HTMLFormElement>, 'defaultValue' | 'onChange'> & {
  defaultValue: ObjectAny,
  order?: (string|FormCustomRender)[],
  options?: FormOptions,
  onChange: (e:React.ChangeEvent<HTMLInputElement>, name:string, subname?:string) => void,
  onFile?: (v:Electron.OpenDialogReturnValue, name:string, subname?:string) => any
}

const bss_form = bem("uiform")
export const Form: FC<IForm> = ({ className, defaultValue, order, options = {}, onChange, onFile }) => (
  <form
    className={cx(bss_form(), className)}
    onSubmit={e => e.preventDefault()}
  >
    {(order || Object.keys(defaultValue)).map((name) => {
      // custom render
      if (typeof name === "function")
        return (
          <div className={bss_form("custom")} key={`custom-${name}`}>
            {name()}
          </div>
        )

      const opts = options[name] || {}
      // multiple inputs
      if (Array.isArray(defaultValue[name]) || opts.columns || opts.names) {
        const columns = opts.columns || opts.names.length
        const subnames:string[][] = (opts.names || new Array(defaultValue[name].length))
          .reduce((res, _, i, arr) => {
            if (i % columns === 0) {
                const chunk = arr.slice(i, i + columns);
                res.push(chunk);
            }
            return res
          }, [])

        return (
          <div
            className={bss_form("group")}
            key={`group-${name}`}
          >
            {opts.label !== false && <div className={bss_form("group-label")}>{opts.label || capitalize(name)}</div>}
            <div className={bss_form("subgroups")}>
              {subnames.map((group, g) => 
                <div
                  key={`group-${g}`}
                  className={bss_form("subgroup")}
                > 
                  {group.map((subname) => {
                    const suboptions = opts.options ? { ...opts, label:null, ...opts.options[subname] } : opts
                  
                    return (
                      <Input 
                        className={bss_form("input")}
                        key={subname} 
                        name={name}
                        defaultValue={defaultValue[name][subname]}
                        onChange={e => onChange(e, name, subname)}
                        onFile={e => onFile(e, name, subname)}
                        placeholder={subname}
                        title={subname}
                        {...suboptions} 
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      }
      
      // single input
      return (
        <Input 
          key={name} 
          label={capitalize(name)}
          name={name}
          defaultValue={defaultValue[name]}
          onChange={e => onChange(e, name)}
          onFile={e => onFile(e, name)}
          title={opts.title}
          {...options[name]} 
        />
      )
    })}
  </form>
)

// Electron

interface chooseFileOptions extends Electron.OpenDialogOptions {
  multiple?: boolean,
  folder?: boolean
}

export class Electron {
  static menu(template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[]) {
    const menu = Menu.buildFromTemplate(template)
    menu.popup()
  }

  static chooseFile(options: chooseFileOptions = {}) {
    return dialog.showOpenDialog({
      properties: [options.folder ? 'openDirectory' : 'openFile', options.multiple ? 'multiSelections' : null],
      ...options
    })
  }

  static openDevTools() {
    getCurrentWindow().webContents.openDevTools()
  }
}


// Util

export type ObjectAny<T = any> = {[key:string]:T}
export type ValueOf<T> = T[keyof T]
export type GetLength<original extends any[]> = original extends { length: infer L } ? L : never
// export type GetLast<original extends any[]> = original[Prev<GetLength<original>>]

declare global {
  interface ObjectConstructor {
      typedKeys<T>(obj: T): Array<keyof T>
  }
}
Object.typedKeys = Object.keys as any

export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

export const useWindowSize = () => {
  const [size, setSize] = useState([window.innerWidth, window.innerHeight])

  useEffect(() => {
    let evt = () => {
      setSize([window.innerWidth, window.innerHeight])
    }
    window.addEventListener('resize', evt)
    return () => {
      window.removeEventListener('resize', evt)
    }
  }, [])

  return size
}

type IObjectGet = <T = any>(obj?:ObjectAny|T, ...args:string[]) => T

export const ObjectGet:IObjectGet = (obj, ...args) => {
  obj = obj as ObjectAny
  if (obj != null && typeof obj === "object" && args.length > 0)
    return ObjectGet(obj[args[0]], ...args.splice(1)) 
  return args.length === 0 ? obj : null
}

// export const ObjectVerify = (obj:ObjectAny, other:ObjectAny) => 
//   Object.keys(other)
//     .forEach(k => {
//       if (obj[k] && typeof other[k] === 'object')
//         ObjectVerify(obj[k], other[k])
//       else if (obj[k] == null) {
//         obj[k] = Object.assign() other
//       }
//     })

export const useEvent = (type:string|string[], listener:any, deps?:DependencyList, object:EventTarget = window) => {
  
  const callback = useCallback((...args:any[]) => {
    requestAnimationFrame(listener.bind(undefined, ...args))
  }, [listener, ...deps])
  const types = [].concat(type)

  useEffect(() => {
    types.forEach(type => object.addEventListener(type, callback))
    return () => {
      types.forEach(type =>   object.removeEventListener(type, callback))
    }
  }, [callback])
}

export const useLayoutEvent = (type:string|string[], listener:any, deps?:DependencyList, object:EventTarget = window) => {
  const callback = useCallback(listener, deps)
  const types = [].concat(type)

  useLayoutEffect(() => {
    types.forEach(type => object.addEventListener(type, callback))
    return () => {
      types.forEach(type =>   object.removeEventListener(type, callback))
    }
  }, [callback])
}

type IStringifyJson = (
  data: ObjectAny,
  options?: {
    language?:string,
    equals?:string,
    array?:[string,string],
    key?:{
      [key:string]: (key:string) => string 
    }
    value?:{ 
      [key:string]: (key:string) => string 
    },
    array_width?:ObjectAny<number>
  }
) => string

export const stringifyJSON:IStringifyJson = (data, options) => {
  if (options.language === "lua") {
    options = {
      equals: '=',
      array: ['{','}'],
      key: {
        number: k => `[${k}]`
      },
      value: {
        string: k => `"${k}"`
      },
      ...options
    }
  }

  const { 
    equals=':',
    array=['[',']'],
    key={},
    value={},
    array_width={}
  } = options

  const _stringify = (data:any, depth=1, from=""):string => {
    const indent = new Array(depth).fill('    ').join('')
    const indent_lessone = new Array(Math.max(0, depth-1)).fill('    ').join('')
    const type = typeof data
    const inline = !!array_width[from]
    const newline = inline ? ' ' : '\n'

    const next_from = (k:string) => from.length > 0 ? `${from}.${k}` : k

    switch (type) {
      case "object":
        if (Array.isArray(data)) {
          if (data.length === 0)
            return `${array[0]}${array[1]}`
          else if (!array_width[from] && data.some(d => typeof d === "object")) {
            const arr = Object.values(data).map((v, i) => 
              `${Array.isArray(data) && i !== 0 ? indent : ''}${_stringify(v, depth+1, from)}`
            )
            return `${array[0]}\n${indent}${arr.join(',\n')}\n${indent_lessone}${array[1]}`
          } else {
            const arr = Object.values(data).map((v) => _stringify(v, typeof v === "object" ? depth+1 : 0, from))
            let new_arr = []
            for (let i = 0, j = arr.length; i < j; i += array_width[from]) {
              new_arr.push(indent + arr.slice(i, i + array_width[from]).join(','))
            }
            return `${array[0]}\n${new_arr.join(',\n')}\n${indent_lessone}${array[1]}` 
          }
        } else if (Object.keys(data).length === 0)
            return "{}"
        else 
          return `{${newline}${Object.entries(data).filter(([_, v]) => v != undefined).map(([k,v]) => 
            `${inline ? '' : indent}${key[typeof k] ? key[typeof k](k) : k} ${equals} ${_stringify(v, depth+1, next_from(k))}`
            ).join(`, ${newline}`)}${newline}${inline ? '' : indent_lessone}}`
      case "number":
        if (!isFinite(data))
            return "\"Inf\""
        else if (isNaN(data))
            return "\"NaN\""
        return value[type] ? value[type](data) : data 
      case "string":
        return `"${data.replace(/"/g, '\\"')}"`
      case "boolean":
        return data ? "true" : "false"
      default:
        return "null"
    }
  }
  
  return _stringify(data)
}

export const { isDev } = remoteRequire("./util.js")

export const dispatchEvent = (name:string, detail:CustomEventInit) => {
  const event = new CustomEvent(name, detail)
  window.dispatchEvent(event)
}

export { css, cx }