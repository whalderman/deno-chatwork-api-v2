import * as assert from "jsr:@std/assert";
import { ChatworkClient } from "./main.ts";

let chatworkClient: ChatworkClient;

Deno.test(function construct() {
	assert.assertExists(chatworkClient = ChatworkClient.create());
});

Deno.test(async function getMe() {
	const me = await chatworkClient.getMe();
	assert.assertExists(me);
});

// TODO check remaining endpoints
