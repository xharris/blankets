import { getCurrentWindow } from "@electron/remote"
import { bem, Button } from "ts/ui"
import { useProject } from "ts/project"

const bss = bem("nav")

export const Nav = () => {
  const { name, openProjectDialog } = useProject()

  return (
    <div className={bss({ reverse: process.platform === "darwin" })}>
      <div className={bss("left")}>
        <div className={bss("title-container")}>
          <div className={bss("title")}>{name}</div>
        </div>
        <Button className={bss("open")} icon="folder" onClick={() => openProjectDialog()} />
      </div>
      <div className={bss("win-buttons", { reverse: process.platform === "darwin" })}>
        <Button className={bss("min")} icon="minus" />
        <Button className={bss("max")} icon="square" />
        <Button className={bss("close")} icon="x" color="#F44336" 
          onClick={() => getCurrentWindow().close()} 
        />
      </div>
    </div>
  )
}