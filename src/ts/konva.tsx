import * as Konva from "react-konva"
import * as KonvaShape from "konva/lib/Shape"
import * as KonvaContext from "konva/lib/Context"
import { ComponentProps, FC } from "react"
import useImage from "use-image"

export * as KonvaNode from "konva/lib/Node"

// ParticleContainer, Stage, Container, Graphics, BitmapText, Sprite,

interface IStage {
  className?:string
}

export const Stage:FC<IStage & ComponentProps<typeof Konva.Stage>> = ({ ...props }) => (
  <Konva.Stage {...props} />
)

interface ILayer {

}

export const Layer:FC<ILayer & ComponentProps<typeof Konva.Layer>> = ({  ...props }) => (
  <Konva.Layer {...props} />
)

export type GraphicsDrawFn = (con: KonvaContext.Context, shape: KonvaShape.Shape<KonvaShape.ShapeConfig>) => void

interface IGraphics {
  draw?: GraphicsDrawFn
}

export const Graphics:FC<IGraphics & ComponentProps<typeof Konva.Shape>> = ({ draw, ...props }) => (
  <Konva.Shape 
    {...props}
    sceneFunc={draw}
  />
)

interface IGroup {

}

export const Group:FC<IGroup & ComponentProps<typeof Konva.Group>> = ({  ...props }) => (
  <Konva.Group {...props} />
)

interface ISprite {
  className?:string,
  path?:string
}

export const Sprite:FC<ISprite & Omit<ComponentProps<typeof Konva.Image>, "image">> = ({ path, ...props }) => {
  const [image] = useImage(path)

  return (
    <Konva.Image {...props} image={image} />
  )
}

interface IText {

}


// useEffect(() => {
//   if (!PIXI.BitmapFont.available["proggy_scene"]) {
//     PIXI.BitmapFont.from("proggy_scene", {
//       fontFamily: "ProggySquare",
//       fontSize: 16,
//       fill: 0xFAFAFA,
//       stroke: 0x212121,
//       strokeThickness: 2
//     }, {
//       chars: PIXI.BitmapFont.ASCII
//     })
//   }
// }, [])

// return PIXI.BitmapFont.available["proggy_scene"] ? (
//   <KonvaText 
//     {...props}
//     style={{ ...props.style, fontName: "proggy_scene" }}
//   />
// ) : null

export const Text:FC<IText & ComponentProps<typeof Konva.Text>> = ({ ...props }) => (
  <Konva.Text {...props} />
)
