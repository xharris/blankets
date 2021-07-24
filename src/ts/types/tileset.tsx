import { bem, cx, css, css_popbox, Button, Form, ObjectAny } from "ts/ui"
import { FCItemBody } from "ts/sidebar"
import { useCallback, useEffect, useState } from "react"
import TileBgImage from "./tilebg.png"
import { useProject } from "ts/project"
import { basename } from "path"
import { useCanvasCtx } from "ts/canvas"


const bss = bem("tileset")

export const Tileset: FCItemBody = ({ id, image, size, crop, name, updateItem, setImages }) => {
  // const { data:{ opened }, update } = useGlobalCtx("tileset")
  const [imageSize, setImageSize] = useState([0,0])
  const [selectedTiles, setSelectedTiles] = useState<ObjectAny<number>>({})
  const [zoom, setZoom] = useState<number>(1)
  const { assets } = useProject() // HELP: assets are empty
  const canvas = useCanvasCtx()

  let croppedImageSize = [imageSize[0] - (crop.x || 0), imageSize[1] - (crop.y || 0)]
  if (crop.w)
    croppedImageSize[0] = crop.w
  if (crop.h)
    croppedImageSize[1] = crop.h

  let tile_count = Math.ceil((croppedImageSize[0] / size.w) * (croppedImageSize[1] / size.h))
  if (!isFinite(tile_count))
    tile_count = 0

  useEffect(() => {
    let cols = Math.floor(croppedImageSize[0] / size.w)
    let rows = Math.floor(croppedImageSize[0] / size.h)

    let tiles = Object.typedKeys(selectedTiles)
      .filter(idx => selectedTiles[idx])
      .map(idx => parseInt(idx as string))
      .map(idx => ({
        path: image,
        x: (idx % cols) * size.w, y: (Math.floor(idx / cols) % rows)* size.h,
        w: size.w, h: size.h
      }))
    canvas.setSelectedTiles(...tiles)
  }, [selectedTiles, image, size])

  const onTileClick = useCallback((idx, v) => {
    setSelectedTiles({
      ...selectedTiles,
      [idx]: v
    })
  }, [setSelectedTiles, selectedTiles, image])

  useEffect(() => {
    if (image) {
      setImages(id, image)
      setSelectedTiles({})
    }
  }, [id, image, size])

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
              <Button icon="x-square" title="clear selected tiles" onClick={() => setSelectedTiles({})} />
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
              width: ${Math.min(croppedImageSize[0] * zoom, 200)}px;
              height: ${Math.min(croppedImageSize[1] * zoom, 200)}px;
              overflow: ${(croppedImageSize[0] * zoom) > 200 || (croppedImageSize[1] * zoom) > 200 ? 'auto' : 'hidden'};
            `)}>
              <div className={cx(bss("preview-inner"), css`
                  transform: scale(${zoom});
              `)}>
                <div className={cx(bss("overlay"), css`
                  width: ${croppedImageSize[0]}px;
                  height: ${croppedImageSize[1]}px;

                  // transform: scale(${zoom});
                `)}>
                  {new Array(tile_count).fill(0).map((_, idx) => (
                    <div 
                      key={`tile-${idx}`}
                      className={cx(bss("tile", { selected: !!selectedTiles[idx] }), css`
                        width: ${size.w}px;
                        height: ${size.h}px;
                      `)}
                      onMouseDown={e => 
                        onTileClick(idx, e.buttons === 1)
                      }
                      onMouseOver={e => {
                        if (e.buttons !== 0)
                          onTileClick(idx, e.buttons === 1)
                      }}
                    />
                  ))}
                </div>
                <div className={cx(bss("image-crop"), css`
                  transform: translate(${-crop.x || 0}px, ${-crop.y || 0}px) ;
                `)}>
                  <img
                    src={`file://${image}`} 
                    onLoad={e => { setImageSize([e.currentTarget.clientWidth, e.currentTarget.clientHeight]) }}
                  />
                </div>
              </div>
            </div>
          ), 
          "size", 
          "crop"
        ]}
        options={{
          image: { 
            type:"select", 
            values: assets.image.map(img => [img, basename(img)])
          },
          size: {
            type: "number",
            label: "Frame",
            columns: 2,
            min: 0,
            names: ['w', 'h'],
            options: {
              w: {
                max: imageSize[0]
              },
              h: {
                max: imageSize[1]
              }
            }
          },
          crop: {
            type: "number",
            columns: 2,
            min: 0,
            names: ['x', 'y', 'w', 'h']
          }
        }}
        onChange={(e, name, subname) => {
          switch (name) {
            case "name": 
              updateItem(id, { name: e.target.value }) 
              break
            case "size":
              updateItem(id, { size: { ...size, [subname]: e.target.valueAsNumber } })
              break 
            case "crop":
              updateItem(id, { crop: { ...crop, [subname]: e.target.valueAsNumber } })
              break
            case "image":
              updateItem(id, { image: e.target.value })
              break
          }
        }}
      />
    </div>
  )
}