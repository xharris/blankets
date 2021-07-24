import { ThemeProvider } from 'ts/ui';
import { Nav } from "ts/nav"
import { Sidebar } from "ts/sidebar"
import { Tileset } from "ts/types/tileset"
import { Layer } from "ts/types/layer"
import { Map } from "ts/types/map"
import { Node } from "ts/types/node"
import { Canvas } from "ts/canvas"
import { GlobalCtxProvider } from 'ts/globalcontext';
import { SaveCtxProvider } from 'ts/savecontext';
import { useCanvasCtx } from "ts/canvas"

import './App.css';
import "sass/index.scss";

const App = () => {
  // const project_path = "/home/xhh/Documents/PROJECTS/lua_fun/love2deng"
  // const map_path = "/home/xhh/Documents/PROJECTS/lua_fun/love2deng/assets/map"

  return (
    <GlobalCtxProvider>
      <SaveCtxProvider>
        <ThemeProvider value={{
          color: {
            fg: "#FDD835",
            bg: "#FAFAFA",
            type: {
              // entity: "#C8E6C9",
              // component: "#B2EBF2",
              // system: "#F8BBD0",

              layer: "#64B5F6",
              node: "#B0BEC5",
              tileset: "#FFB74D",
              label: "#81C784",
              map: "#B39DDB"
            }
          }
        }}>
          <AppBody />
        </ThemeProvider>
      </SaveCtxProvider>
    </GlobalCtxProvider>
  );
}


const AppBody = () => {
  const { addLayer, removeLayer, setCurrentLayer, addMap, removeMap, setCurrentMap } = useCanvasCtx()

  return (
    <div className="App">
      <Nav />
      <Sidebar
        defaultItem={{
          layer: { 
            z: 0,
            snap: { x:32, y:32 },
            offset: { x:0, y:0 }
          },
          tileset: {
            size: {/* w, h */},
            crop: {/* x, y, w, h */},
            margin: {/* x, y */}
          }
        }}
        sort={{ layer: 'z' }}
        body={{
          layer: Layer,
          tileset: Tileset,
          map: Map,
          node: Node
        }}
        onItemClick={(e, item) => {
          if (item.type === "layer")
            setCurrentLayer(item.id)
          if (item.type === "map")
            setCurrentMap(item.id)
        }}
        onItemAdd={item => {
          if (item.type === "layer")
            addLayer(item.id, item)
          if (item.type === "map")
            addMap(item.id, item)
        }}
        onItemDelete={item => {
          if (item.type === "layer")
            removeLayer(item.id)
          if (item.type === "map")
            removeMap(item.id)
        }}
      />
      <Canvas />
    </div>
  )
}


export default App;
