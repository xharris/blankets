import { useEffect, useRef, useState } from "react"
import { fabric } from "fabric"
import { bem, useWindowSize } from "ts/ui"

const bss = bem("canvas")

export const Canvas = () => {
  const el_canvas = useRef<HTMLCanvasElement>()
  const [fcanvas, setCanvas] = useState<fabric.Canvas>()
  const [width, height] = useWindowSize()

  useEffect(() => {
    if (el_canvas.current)
       setCanvas(new fabric.Canvas(el_canvas.current, {
         width: el_canvas.current.clientWidth,
         height: el_canvas.current.clientHeight
       }))
  }, [el_canvas])

  useEffect(() => {
    if (fcanvas)
      fcanvas.setDimensions({width, height})
  }, [fcanvas, width, height])

  return (
    <div className={bss()}>
      <canvas ref={el_canvas} />
    </div>
  )
}