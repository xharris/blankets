import { bem, cx, css, css_popbox, Button, Form } from "ts/ui"
import { FCItemBody } from "ts/sidebar"
import { useEffect, useState } from "react"
import TileBgImage from "./tilebg.png"
// import { useGlobalCtx } from "ts/globalcontext"

const bss = bem("tileset")

export const Tileset: FCItemBody = ({ id, image, size, crop, name, updateItem, setImages }) => {
  // const { data:{ opened }, update } = useGlobalCtx("tileset")
  const [imageSize, setImageSize] = useState([0,0])
  const [selectedTiles, setSelectedTiles] = useState<{[key:number]:boolean}>({})
  const [zoom, setZoom] = useState<number>(1)

  useEffect(() => {
    if (image) {
      setImages(id, image)
    }
  }, [id, image, size])

  let croppedImageSize = [imageSize[0] - (crop.x || 0), imageSize[1] - (crop.y || 0)]
  if (crop.w)
    croppedImageSize[0] = crop.w
  if (crop.h)
    croppedImageSize[1] = crop.h

  let tile_count = Math.ceil((croppedImageSize[0] / size.w) * (croppedImageSize[1] / size.h))
  if (!isFinite(tile_count))
    tile_count = 0

  return (
    <div className={bss()}>
      <Form 
        defaultValue={{ name, image, size, crop }}
        order={[
          "name", 
          "image", 
          () => image && (
            <div className={bss("image-info")}>
              <div>{imageSize.join(' x ')}</div>
              <div className={bss("preview-controls")}>
                <Button icon="zoom-out" onClick={() => setZoom(Math.max(zoom - 0.1, 0))} />
                {`${(zoom * 100).toFixed()}%`}
                <Button icon="zoom-in" onClick={() => setZoom(Math.min(zoom + 0.1, 2))} />
              </div>
            </div>
          ),
          () => image && (
            <div className={cx(bss("preview"), css_popbox("#212121"), css`
              background-image: url(${TileBgImage});
              background-position: ${-crop.x || 0}px ${-crop.y || 0}px;
              width: ${Math.min(croppedImageSize[0], 200)}px;
              height: ${Math.min(croppedImageSize[1], 200)}px;
              ${croppedImageSize[0] > 200 && croppedImageSize[1] > 200 && `
              overflow: auto;
              `}
            `)}>
              <div className={cx(bss("overlay"), css`
                width: ${croppedImageSize[0]}px;
                height: ${croppedImageSize[1]}px;
                transform: scale(${zoom});
              `)}>
                {new Array(tile_count).fill(0).map((_, idx) => (
                  <div 
                    key={`tile-${idx}`}
                    className={cx(bss("tile", { selected: !!selectedTiles[idx] }), css`
                      width: ${size.w}px;
                      height: ${size.h}px;
                    `)}
                    onClick={() => {
                      setSelectedTiles({
                        ...selectedTiles,
                        [idx]:!selectedTiles[idx]
                      })
                    }}
                  />
                ))}
              </div>
              <img 
                className={css`  
                  transform: scale(${zoom}) translate(${-crop.x || 0}px, ${-crop.y || 0}px) ;
                  width: ${croppedImageSize[0]}
                  height: ${croppedImageSize[1]}
                `}
                src={`file://${image}`} 
                onLoad={e => { setImageSize([e.currentTarget.clientWidth, e.currentTarget.clientHeight]) }}
              />
            </div>
          ), 
          "size", 
          "crop"
        ]}
        options={{
          image: { 
            type:"file", 
            chooseFileOptions: {
              filters: [
                { name: 'Images', extensions: ['jpg', 'png', 'gif'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            }
          },
          size: {
            type: "number",
            columns: 2,
            min: 0,
            names: ['w', 'h']
          },
          crop: {
            type: "number",
            columns: 2,
            min: 0,
            names: ['x', 'y', 'w', 'h']
          }
        }}
        onChange={(e, name, subname) => {
          console.log(e, name, subname)
          switch (name) {
            case "name": 
              updateItem(id, { name: e.target.value })
              break
            case "size":
              updateItem(id, { size: { ...size, [subname]: e.target.valueAsNumber } })
              break 
            case "crop":
              updateItem(id, { crop: { ...crop, [subname]: e.target.valueAsNumber } })
          }
        }}
        onFile={(res, name) => {
          console.log(res, name)
          switch (name) {
            case "image":
              if (res.filePaths.length > 0)
                updateItem(id, { image: res.filePaths[0] })
              break
          }
        }}
      />
    </div>
  )
}