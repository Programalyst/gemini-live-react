import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
//import AudioCaptureWorkletComponent from "./components/AudioCaptureWorkletComponent";
//import AudioPlayer from "./AudioPlayer";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    {<App />}
    {/*<AudioCaptureWorkletComponent/>*/}
    {/*<AudioPlayer />*/}
  </React.StrictMode>
);
