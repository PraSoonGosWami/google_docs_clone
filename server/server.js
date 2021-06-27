const mongoose = require("mongoose");
const Document = require("./Document_schema");
const password = "defraction44";
const dbName = "google_docs_clone";

mongoose.connect(
  `mongodb+srv://Prasoon:${password}@clusterx.tn29p.mongodb.net/${dbName}?retryWrites=true&w=majority`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  }
);

const io = require("socket.io")(3001, {
  cors: {
    origin: "http://localhost:3000",
    method: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("get-document", async (docId) => {
    const document = await findOrCreateDocument(docId);
    socket.join(docId);
    socket.emit("load-document", document.data);
    socket.on("send-changes", (delta) => {
      socket.broadcast.to(docId).emit("receive-changes", delta);
    });
    socket.on("update-cursor", (cursorData) => {
      socket.broadcast.to(docId).emit("receive-cursor", cursorData);
    });
    socket.on("save-document", async (data) => {
      await Document.findByIdAndUpdate(docId, { data });
    });
  });
});

const findOrCreateDocument = async (id) => {
  if (id == null) return;
  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: "" });
};
