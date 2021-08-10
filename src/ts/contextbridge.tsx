import React from "react";

import { GlobalCtx } from "./globalcontext"
import { SaveCtx } from "./savecontext"

export type ContextBridgeProps = {
  container: (children: React.ReactElement | null) => React.ReactElement | null,
  contexts?: React.Context<any>[],
  children: React.ReactNode
}

export const ContextBridge = ({ container, contexts=[ GlobalCtx, SaveCtx ], children }:ContextBridgeProps) => {
  const providers = (values:any[]) => {

      const getValue = (i:any) => values[ values.length - 1 - i ];

      return <>
        {contexts.reduce((innerProviders, Context, i) => (
          <Context.Provider value={getValue(i)}>
              {innerProviders}
          </Context.Provider>
        ), children)}
      </>;
  };

  const consumers = contexts.reduce((getChildren, Context) => (
      (values:React.ReactNode[]) => <Context.Consumer>
          {value => getChildren([ ...values, value ])}
      </Context.Consumer>
  ), (values:any[]) => container(providers(values)));

  return consumers([]);
}