# Chatwork API v2 Deno ライブラリ

```ts
const token = "1234asdf1234asdf";
const cw = ChatworkClient.create({token});

const myChatRoomId = Infinity;
const response = await cw.postRoomMessage(
  myChatRoomId,
  {
    body: "You get that thing I sent ya?",
    self_unread: true
  }
);

console.log(response);
```