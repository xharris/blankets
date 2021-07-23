import { css, cx } from "@emotion/css"
import * as FIcon from "react-feather"
import { dialog, Menu } from "@electron/remote"
import React, { FunctionComponent, HTMLAttributes, createContext, useContext, InputHTMLAttributes, FormHTMLAttributes, useState, useEffect } from "react"
import tinycolor from "tinycolor2"
import { basename } from "path"

// CSS / Styling 

type BemBlockModifiers = { [key: string]: any; }
type BemBlockFn = (element?: string | BemBlockModifiers, modifiers?: BemBlockModifiers, excludeRoot?: boolean) => string

interface IThemeProps {
  color: {
    fg: string,
    bg: string,
    type: { [key: string]: string; }
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
  
  const shadow = tinycolor(color).darken(25).toHexString()

  // const shadow = tinycolor(color).lighten(20).toHexString()
  const bg_color = tinycolor(color).brighten(10).toHexString()
  const text_color = tinycolor(color).isDark() ? tinycolor(color).brighten(50).toHexString() : shadow
  return css`
    color: ${text_color};
    background-color: ${bg_color};
    border: ${Math.max(0, thickness-2)}px solid transparent;
    border-radius: ${thickness}px;
    margin-right: ${thickness-1}px;
    // box-sizing: border-box;

    ${only_hover ? '&:hover' : '&'} {
      box-shadow: ${new Array(thickness).fill(0).map((_, i) => `${i}px ${i}px ${shadow}`).join(', ')} ;
      border-color: ${color};
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
      &:hover {
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
  label?: string,
  inputClassName?: string,
  chooseFileOptions?:chooseFileOptions,
  onFile?: (v:Electron.OpenDialogReturnValue) => any,
  onError?: (...args:any[]) => void,
  icon?: string,
  values?: [string, string][]
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
  icon = "file",
  values,
  ...props 
}) => {
  const [value, setValue] = useState<string[]>([].concat(props.defaultValue).filter(p => p))
  
  return (
    <label
      className={cx(bss_input({ labeled: !!label }), className)}
      title={title}
    >
      {label}
      {type === "file" ? 
        <Button
          className={cx(bss_input("file-input"), inputClassName)}
          text={value.length > 0 ? value.map(p => basename(p)).join(', ') : "Choose file..."}
          icon={icon}
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
          defaultValue={null}
          value={props.defaultValue || "_DEFAULT_"}
          title={(title || props.defaultValue || "").toString()}
        >
          <option key="_default" value="_DEFAULT_" disabled hidden>{props.placeholder || "..."}</option>
          {values.map(v => {
            const [value, label] = v
            return <option key={value} value={value}>{label}</option>
          })}
        </select>
      :
        <input
          className={cx(bss_input("input"), inputClassName)}
          type={type}
          {...props}
        />
      }
    </label>
  )
}

type FormCustomRender = () => {}

interface FormOption extends IInput {
  columns?: number,
  names?: string[],
  options?: {[key:string]:FormOption}
}

type IForm = Omit<FormHTMLAttributes<HTMLFormElement>, 'defaultValue' | 'onChange'> & {
  defaultValue: ObjectAny,
  order?: (string|FormCustomRender)[],
  options?: { [key:string]:FormOption },
  onChange: (e:React.ChangeEvent<HTMLInputElement>, name:string, subname?:string) => void,
  onFile?: (v:Electron.OpenDialogReturnValue, name:string, subname?:string) => any
}

const bss_form = bem("uiform")
export const Form: FC<IForm> = ({ className, defaultValue, order, options = {}, onChange, onFile }) => (
  <form
    className={cx(bss_form(), className)}
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
            <div className={bss_form("group-label")}>{opts.label || capitalize(name)}</div>
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
}

// Util

export type ObjectAny<T = any> = {[key:string]:T}

export type ValueOf<T> = T[keyof T]

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

export { css, cx }