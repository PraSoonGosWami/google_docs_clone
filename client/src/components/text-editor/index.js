import React, { useCallback, useEffect, useState } from "react";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import ImageResize from "quill-image-resize-module-react";
import { useParams } from "react-router";
import { io } from "socket.io-client";
import "quill/dist/quill.snow.css";
import { v4 as uuidv4 } from "uuid";

const Size = Quill.import("attributors/style/size");
Size.whitelist = [
  "8px",
  "9px",
  "10px",
  "11px",
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "22px",
  "24px",
  "26px",
  "28px",
  "36px",
  "48px",
  "60px",
  "72px",
  "96px",
];
Quill.register(Size, true);
Quill.register("modules/cursors", QuillCursors);
Quill.register("modules/imageResize", ImageResize);

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ size: Size.whitelist }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

const TextEditor = () => {
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();
  const [uid, setUid] = useState(uuidv4());
  const [name, setName] = useState("");
  const [cursors, setCursor] = useState(null);
  const { id: docId } = useParams();

  const editorRef = useCallback((wrapper) => {
    if (!wrapper) return;
    wrapper.innerHTML = "";

    const editor = document.createElement("div");
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: "snow",
      modules: {
        toolbar: TOOLBAR_OPTIONS,
        cursors: true,
        imageResize: {
          parchment: Quill.import("parchment"),
        },
      },
    });
    q.disable();
    q.setText("Loading...");
    setCursor(q.getModule("cursors"));

    setQuill(q);
  }, []);

  //set up socket
  useEffect(() => {
    const s = io("http://localhost:3001");
    setSocket(s);
    setName(prompt("Please enter name"));
    return () => {
      s.disconnect();
    };
  }, []);

  //save changes
  useEffect(() => {
    if (socket == null || quill == null) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill]);

  //loading documents
  useEffect(() => {
    if (!quill || !socket) return;
    socket.on("load-document", (document) => {
      quill.setContents(document);
      quill.enable();
    });
    socket.emit("get-document", docId);
  }, [quill, socket, docId]);

  //updates changes
  useEffect(() => {
    if (!socket || !quill) return;
    const handler = (delta, oldData, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };
    const cursorHandler = (range, oldRange, source) => {
      socket.emit("update-cursor", {
        userId: uid,
        userName: name,
        range,
        color: "red",
      });
    };
    quill.on("text-change", handler);
    quill.on("selection-change", cursorHandler);

    return () => {
      quill.off("text-change", handler);
      quill.off("selection-change", cursorHandler);
    };
  }, [quill, socket]);

  //fetches changes
  useEffect(() => {
    if (!socket || !quill) return;
    const handler = (delta) => {
      quill.updateContents(delta);
    };

    const cursorHandler = ({ userId, userName, range, color }) => {
      if (range) {
        cursors.createCursor(userId, userName, color);
        cursors.moveCursor(userId, range);
        cursors.toggleFlag(userId, true);
      } else {
        console.log(userId);
        cursors.removeCursor(userId);
      }
    };

    socket.on("receive-changes", handler);
    socket.on("receive-cursor", cursorHandler);
    return () => {
      socket.off("receive-changes", handler);
      socket.off("receive-cursor", cursorHandler);
      socket.emit("update-cursor", {
        userId: uid,
        range: null,
      });
    };
  }, [quill, socket]);

  return <div className="editor" ref={editorRef}></div>;
};

export default TextEditor;
