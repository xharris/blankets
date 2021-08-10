import { getCurrentWindow } from "@electron/remote"
import { bem, Button, Electron } from "ts/ui"
import { useProject } from "ts/project"

const bss = bem("nav")

export const Nav = () => {
  const { all_data, settings, name, loading, isOpen, openProjectDialog, saveProject } = useProject()

  return (
    <div className={bss({ reverse: process.platform === "darwin" })}>
      <div className={bss("left")}>
        <div className={bss("title-container")}>
          <div className={bss("title")}>{loading ? "..." : name}</div>
        </div>
        <Button 
          className={bss("open")} 
          icon="folder" 
          onClick={() => openProjectDialog()}
          title="Open a project..."  
        />
        <Button 
          className={bss("save")} 
          icon="save" 
          disabled={!isOpen || settings.auto_save} 
          title={settings.auto_save ? "Auto-save is turned on" : "Save project"}
          onClick={() => saveProject()} 
        />
      </div>
      <div className={bss("win-buttons", { reverse: process.platform === "darwin" })}>
        <Button className={bss("max")} icon="printer" title="print project data" onClick={() => console.log(all_data)} />
        <Button className={bss("max")} icon="code" title="open dev tools" onClick={() => Electron.openDevTools()} />

        <Button className={bss("min")} icon="minus" />
        <Button className={bss("max")} icon="square" />
        <Button className={bss("close")} icon="x" color="#F44336" 
          onClick={() => getCurrentWindow().close()} 
        />
      </div>
    </div>
  )
}