import { useGlobalCtx } from "ts/globalcontext"
import { Electron } from "ts/ui"
import { basename } from "path"
import { useEffect, useState } from "react"
import { watch } from "chokidar"
import { FSWatcher, Stats } from "fs"

const EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "bmp", "tga", "hdr", "pic", "exr"],
  code: ["lua"],
  audio: [
    "wav", "mp3", "ogg", "oga", "ogv", "699", "amf", "ams", "dbm", "dmf", "dsm",
    "far", "it", "j2b", "mdl", "med", "mod", "mt2", "mtm", "okt", "psm", "s3m", "stm",
    "ult", "umx", "xm", "abc", "mid", "pat", "flac"
  ]
}

type Assets = { [key in keyof (typeof EXTENSIONS) as string]: string[] }

export const useProject = () => {
  const [assets, setAssets] = useState<Assets>({
    image: [],
    code: [],
    audio: []
  })
  const { data:{ path }, update } = useGlobalCtx("project")

  const fileUpdate = (name: any, stat: Stats) => {
    if (stat.isFile()) {
      const filename = basename(name)

      // update assets
      Object.entries(EXTENSIONS)
        // only get extension types matching this file
        .filter(([_, exts]) => 
          exts.some(ext => filename.endsWith(`.${ext}`))
        )
        // add them to asset list
        .forEach(([type, _]) => {
          if (!assets[type].includes(name)) {
            assets[type].push(name)
            setAssets({ ...assets })
          }
        })
    }
  }
  
  useEffect(() => {
    let watcher:FSWatcher
    if (path) {
      watcher = watch(path, {
        ignored: [
          "**/node_modules/**",
          /(^|[\/\\])\../
        ]
      })
      watcher.on('add', fileUpdate)
      watcher.on('change', fileUpdate)
    }

    return () => {
      if (watcher)
        watcher.close()
      watcher = null
    }
  }, [path])

  const openProjectDialog = () => {
    // choose project location
    Electron.chooseFile({ folder:true })
    .then(result => {
      if (result.filePaths.length > 0) {
        update({ path: result.filePaths[0] })
        // if main.lua doesn't exist, ask if one should be created
      }
    })
    .catch(() => {})
  }

  return { 
    get name () { return basename(path || "BlankE") },
    get isOpen () { return !!path },
    path: path,
    assets,
    openProjectDialog
  }
}