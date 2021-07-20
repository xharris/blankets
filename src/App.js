import './App.css';

import { ThemeProvider } from 'ts/ui';
import { Nav } from "ts/nav"
import { Sidebar } from "ts/sidebar"
import { Tileset } from "ts/types/tileset"
import { Layer } from "ts/types/layer"
import { Canvas } from "ts/canvas"
import { GlobalCtxProvier } from 'ts/globalcontext';

import "sass/index.scss";

function App() {
  const project_path = "/home/xhh/Documents/PROJECTS/lua_fun/love2deng"
  const map_path = "/home/xhh/Documents/PROJECTS/lua_fun/love2deng/assets/map"

  return (
    <GlobalCtxProvier>
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
            label: "#81C784"
          }
        }
      }}>
        <div className="App">
          <Nav />
          <Sidebar
            defaultItem={{
              layer: { z: 0 },
              tileset: {
                size: {/* w, h */},
                crop: {/* x, y, w, h */},
                margin: {/* x, y */}
              }
            }}
            sort={{ layer: 'z' }}
            body={{
              layer: Layer,
              tileset: Tileset
            }}
            onItemClick={(e, item) => console.log(item)}
          />
          <Canvas />
        </div>
      </ThemeProvider>
    </GlobalCtxProvier>
  );
}

export default App;
