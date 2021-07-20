import { Button } from "./ui"
import { getCurrentWindow } from "@electron/remote"
import { bem } from "ts/ui"

const bss = bem("nav")

const WinButtons = () => (
  <div className={bss("win-buttons", { reverse: process.platform === "darwin" })}>
    <Button className={bss("min")} icon="minus" />
    <Button className={bss("max")} icon="square" />
    <Button className={bss("close")} icon="x" color="#F44336" 
      onClick={() => getCurrentWindow().close()} 
    />
  </div>
)

export const Nav = () => {
  return (
    <div className={bss()}>
      <div className={bss("left")}>
        {process.platform === "darwin" && <WinButtons />}
      </div>
      <div className={bss("right")}>
        {process.platform !== "darwin" && <WinButtons />}
      </div>
    </div>
  )
}