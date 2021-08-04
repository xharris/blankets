import { ThemeProvider } from 'ts/ui';
import { Nav } from "ts/nav"
import { Sidebar } from "ts/sidebar"
import { Tileset } from "ts/types/tileset"
import { Layer } from "ts/types/layer"
import { Map } from "ts/types/map"
import { Node } from "ts/types/node"
import { Label } from "ts/types/label"
import { Canvas } from "ts/canvas"
import { GlobalCtxProvider } from 'ts/globalcontext'
import { SaveCtxProvider } from 'ts/savecontext'

import "sass/index.scss";
import { useEffect } from 'react';

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


const AppBody = () => (
  <div className="App">
    <Nav />
    <Sidebar
      defaultItem={{
        map: {
          snap: { x:32, y:32 }
        },
        layer: { 
          z: 0,
          snap: {/* x, y */},
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
        layer: (a,b) => a.z - b.z
      }}
      noselect={["layer", "map"]}
      body={{
        layer: Layer,
        tileset: Tileset,
        map: Map,
        node: Node,
        label: Label
      }}
    />
    <Canvas />
  </div>
)


export default App;
