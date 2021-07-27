import { ThemeProvider } from 'ts/ui';
import { Nav } from "ts/nav"
import { Sidebar } from "ts/sidebar"
import { Tileset } from "ts/types/tileset"
import { Layer } from "ts/types/layer"
import { Map } from "ts/types/map"
import { Node } from "ts/types/node"
import { Canvas } from "ts/canvas"
import { GlobalCtxProvider } from 'ts/globalcontext'
import { SaveCtxProvider } from 'ts/savecontext'

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
          },
          node: {
            connect_type: "none"
          }
        }}
        sort={{ 
          layer: 'z'
        }}
        body={{
          layer: Layer,
          tileset: Tileset,
          map: Map,
          node: Node
        }}
      />
      <Canvas />
    </div>
  )
}


export default App;
