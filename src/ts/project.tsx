import { useGlobalCtx } from "ts/globalcontext"
import { Electron, ObjectGet } from "ts/ui"
import { basename, join } from "path"
import { useCallback, useEffect } from "react"
import { watch } from "chokidar"
import { FSWatcher, pathExists, readFile, Stats, writeFile } from "fs-extra"
import { useSaveCtx } from "./savecontext"

const EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "bmp", "tga", "hdr", "pic", "exr"],
  code: ["lua"],
  audio: [
    "wav", "mp3", "ogg", "oga", "ogv", "699", "amf", "ams", "dbm", "dmf", "dsm",
    "far", "it", "j2b", "mdl", "med", "mod", "mt2", "mtm", "okt", "psm", "s3m", "stm",
    "ult", "umx", "xm", "abc", "mid", "pat", "flac"
  ]
}

type AssetAction = {
  type: "image" | "code" | "audio",
  path: string
}

const defaultProject = {
  settings: {
    auto_save: false,
    history_size: 10
  }
}

export const useProject = () => {
  const { data:{ past, future }, update:updateHistory } = useGlobalCtx("history", {
    past: [],
    future: []
  })
  const { data:{ path, loading, assets }, update } = useGlobalCtx("project", {
    path: null,
    loading: false,
    assets: { image:[], code:[], audio:[] }
  })
  const { all_data, data:savedata, load } = useSaveCtx("project", defaultProject)

  // useEffect(() => {
  //   console.log(all_data)
  // }, [all_data])

  const saveHistory = useCallback(() => {
    updateHistory({
      past: [
        ...(past.length > savedata.settings.history_size ? past.splice(0,1) : past), 
        { ...all_data }
      ],
      future: []
    })
  }, [past, updateHistory, savedata, all_data])

  const resetHistory = useCallback(() => {
    updateHistory({
      past: [],
      future: []
    })
  }, [updateHistory])

  useEffect(() => {
    const onkeydown = (e:KeyboardEvent) => {
      const key = e.key.toLowerCase()
      // undo
      if (e.ctrlKey && key === 'z' && past.length > 0) {
        load(past[past.length - 1])
        updateHistory({ 
          past: past.splice(0, past.length - 1),
          future: [ ...future, { ...all_data } ]
        })
      }
      // redo
      if (e.ctrlKey && (key === 'y' || (e.shiftKey && key === 'z')) && future.length > 0) {
        load(future[future.length - 1])
        updateHistory({ 
          past: [ 
            ...(past.length > savedata.settings.history_size ? past.splice(0,1) : past), 
            { ...all_data }
          ],
          future: future.splice(0, future.length - 1)
        })
      }
    }

    window.addEventListener('keydown', onkeydown)

    return () => {
      window.removeEventListener('keydown', onkeydown)
    }
  }, [past, future, update, load])

  const addAsset = useCallback((type:AssetAction["type"], path:string) => {
    if (ObjectGet(assets, type) && !assets[type].includes(path))
      update({ 
        assets: {
          ...assets,
          [type]: [
            ...assets[type],
            path
          ]
        }
      })
  }, [assets, update])

  const fileUpdate = useCallback((name: any, stat: Stats) => {
    if (stat.isFile()) {
      const filename = basename(name)
      // update assets
      Object.typedKeys(EXTENSIONS)
        // only get extension types matching this file
        .filter((type) => EXTENSIONS[type].some(ext => filename.endsWith(`.${ext}`)))
        // add them to asset list
        .forEach((type) => addAsset(type, name))
    }
  }, [addAsset])

  const saveProject = useCallback(() => {
    if (all_data && path) {
      console.log("saving")
      writeFile(join(path, 'blanke.json'), JSON.stringify({
        ...all_data,
        project: {
          ...all_data.project,
          path: undefined
        }
      }))
    }
  }, [all_data, path])

  useEffect(() => {
    const auto_save = ObjectGet(savedata, "settings", "auto_save")
    if (auto_save) {
      saveProject()
    }
  }, [savedata, saveProject])
  
  useEffect(() => {
    let watcher:FSWatcher
    if (path) {
      // watch the directory for assets
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
  }, [path, fileUpdate])

  const loadProject = useCallback((new_path, load_data) => {
    load({ ...defaultProject, ...load_data })
    update({ path:new_path, loading:false })
    resetHistory()
  }, [load, update, resetHistory])

  const openProjectDialog = useCallback(() => {
    // choose project location
    Electron.chooseFile({ folder:true })
    .then(result => {
      update({ loading:true })
      if (result.filePaths.length > 0) {
        const new_path = result.filePaths[0]
        const json_path = join(new_path, 'blanke.json')
        // if main.lua doesn't exist, ask if one should be created
        pathExists(json_path)
          .then(exists => {
            if (!exists) {
              return writeFile(json_path, JSON.stringify({}))
            } else {
              return readFile(json_path, 'utf8').then(JSON.parse)
            }
          })
          // load blanke.json
          .then(load_data => loadProject(new_path, load_data))
      }
    })
    .catch(() => {
      update({ path:null, loading:false })
    })
  }, [loadProject, update])

  return { 
    name: basename(path || "BlankE"),
    isOpen: !!path && !loading,
    settings: savedata.settings,
    path,
    assets,
    loading,
    openProjectDialog,
    saveProject,
    saveHistory
  }
}