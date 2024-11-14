import { loadSync } from "jsr:@std/dotenv@0.225.2";

/**
 * ChatworkClientをインスタンス化する際のオプション。
 */
interface ChatworkClientOptions {
	/**
	 * Chatworkメッセージの送信に使用するAPIトークンです。
	 * 社内のChatwork管理者からChatwork APIの利用を許可されている場合、
	 * APIトークンは[**ここ**](https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php)で取得できます。
	 */
	token: string;
	/**
	 * Chatwork APIへのHTTPリクエストに使用する[Fetch API](https://developer.mozilla.org/ja/docs/Web/API/Fetch_API)の実装。
	 */
	fetchImpl: typeof fetch;
}

/**
 * Chatwork APIのご利用については [Chatwork API 利用規約](https://go.chatwork.com/ja/terms/api.html)
 * が適用されますので、必ず規約内容を確認した上で、ご利用ください。
 */
export class ChatworkClient {
	static #apiV2Endpoint = "https://api.chatwork.com/v2";

	/**
	 * [Chatwork API](https://developer.chatwork.com/reference) と通信するための新しいクライアントを作成します。
	 */
	static create(
		options: ChatworkClientOptions = { token: "", fetchImpl: fetch },
	): ChatworkClient {
		if (!options.token) {
			console.error(
				"Chatwork APIトークンがChatworkClientコンストラクタに渡されていません。環境変数を確認中…",
			);
			Deno.permissions.requestSync({
				name: "env",
				variable: "CW_API_TOKEN",
			});
			let envToken = Deno.env.get("CW_API_TOKEN");

			if (!envToken) {
				console.error(
					"CW_API_TOKEN環境変数が定義されていません。カレントディレクトリに.envファイルがあるか確認中…",
				);
				Deno.permissions.requestSync({ name: "read", path: ".env" });
				const envVars = loadSync();
				envToken = envVars.CW_API_TOKEN;
			}

			if (!envToken) {
				throw new Error(
					"新しいChatworkClientを初期化するときは、Chatwork APIトークンを渡すか、CW_API_TOKEN環境変数を定義する必要があります。",
				);
			}

			options.token = envToken;
		}
		return new ChatworkClient(options as Required<ChatworkClientOptions>);
	}

	#fetch: typeof fetch;

	readonly token: string;
	#DefaultHeaders: HeadersInit;
	#FormDataHeaders: HeadersInit;

	/**
	 * [Chatwork API](https://developer.chatwork.com/reference) と通信するための新しいクライアントを作成します。
	 */
	private constructor(options: Required<ChatworkClientOptions>) {
		this.token = options.token;
		this.#fetch = options.fetchImpl;
		this.#DefaultHeaders = {
			accept: "application/json",
			"x-chatworktoken": this.token,
		};
		this.#FormDataHeaders = {
			...this.#DefaultHeaders,
			"content-type": "application/x-www-form-urlencoded",
		};
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-me)
	 * 自分自身の情報を取得します。
	 */
	async getMe(): Promise<Me> {
		const res = await this.#fetch(`${ChatworkClient.#apiV2Endpoint}/me`, {
			headers: this.#DefaultHeaders,
		});

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-my-status)
	 * 自分の未読数、未読To数、未完了タスク数を取得します。
	 */
	async getMyStatus(): Promise<MyStatus> {
		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/my/status`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-my-tasks)
	 * 自分のタスク一覧を最大100件まで取得します。
	 *
	 * @param queryParams
	 * **任意**
	 *
	 * 取得したデータをカスタマイズするためのパラメータを含むオブジェクト。
	 *
	 * @param queryParams.assigned_by_account_id
	 * **任意**
	 *
	 * タスクを割り当てたユーザーのアカウントID。
	 *
	 * @param queryParams.status
	 * **任意**
	 */
	async getMyTasks(queryParams: {
		assigned_by_account_id?: string | number;
		status?: TaskStatus;
	}): Promise<MyTask[]> {
		const queryString = queryStringFromParamsObject(queryParams);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/my/tasks${queryString}`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-contacts)
	 * 自分のコンタクト一覧を取得します。
	 */
	async getContacts(): Promise<Contact[]> {
		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/contacts`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms)
	 * チャット一覧を取得します。
	 */
	async getRooms(): Promise<RoomInfo[]> {
		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`POST`（投稿・追加）](https://developer.chatwork.com/reference/post-rooms)
	 * 新しいグループチャットを作成します。
	 *
	 * @param formData
	 *
	 * @param formData.name
	 * グループチャットの名前
	 *
	 * @param formData.description
	 * **任意**
	 * グループチャットの概要
	 *
	 * @param formData.link
	 * **任意**
	 * 招待リンクを作成するか
	 *
	 * @param formData.link_code
	 * **任意**
	 * 招待リンクのパス部分。
	 * 省略するとランダムな文字列となります。使用できない文字を含んでいる場合、
	 * またはすでに存在する値が指定された場合は400エラーを返します。
	 *
	 * @param formData.link_need_acceptance
	 * **任意**
	 * 参加に管理者の承認を必要とするか
	 *
	 * @param formData.members_admin_ids
	 * 管理者権限にしたいユーザーの一覧。
	 * コンタクト済みもしくは組織内のユーザーのアカウントIDをカンマ区切りで指定してください。
	 * 少なくとも1人以上のユーザーを指定する必要があります。
	 *
	 * @param [formData.members_member_ids]
	 * **任意**
	 * メンバー権限にしたいユーザーの一覧。
	 * コンタクト済みもしくは組織内のユーザーのアカウントIDをカンマ区切りで指定してください。
	 *
	 * @param [formData.members_readonly_ids]
	 * **任意**
	 * 閲覧のみ権限にしたいユーザーの一覧。
	 * コンタクト済みもしくは組織内のユーザーのアカウントIDをカンマ区切りで指定してください。
	 *
	 * @param formData.icon_preset
	 * グループチャットのアイコンの種類
	 */
	async postRooms(formData: {
		name: string;
		description?: string;
		link?: number;
		link_code?: string;
		link_need_acceptance?: number;
		members_admin_ids: string | (string | number)[];
		members_member_ids?: string | (string | number)[];
		members_readonly_ids?: string | (string | number)[];
		icon_preset: BuiltInChatworkIcon;
	}): Promise<RoomsPostResponse> {
		if (!formData.name) {
			throw new MissingParameterError("formData.name");
		}
		if (!formData.members_admin_ids) {
			throw new MissingParameterError("formData.members_admin_ids");
		}

		if (Array.isArray(formData.members_admin_ids)) {
			console.log(
				"Joining members_admin_ids into comma-separated string...",
			);
			formData.members_admin_ids = formData.members_admin_ids.join(",");
		}
		if (Array.isArray(formData.members_member_ids)) {
			console.log(
				"Joining members_member_ids into comma-separated string...",
			);
			formData.members_member_ids = formData.members_member_ids.join(",");
		}
		if (Array.isArray(formData.members_readonly_ids)) {
			console.log(
				"Joining members_readonly_ids into comma-separated string...",
			);
			formData.members_readonly_ids = formData.members_readonly_ids.join(
				",",
			);
		}

		const formParams = new URLSearchParams(
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms`,
			{
				method: "post",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id)
	 * チャットの情報（名前、アイコン、種類など）を取得します。
	 *
	 * @param roomId
	 * ルームID
	 */
	async getRoom(roomId: number): Promise<RoomInfoWithDescription> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`PUT`（更新・変更）](https://developer.chatwork.com/reference/put-rooms-room_id)
	 * チャットの情報（名前、アイコンなど）を変更します。
	 *
	 * @param roomId
	 * ルームID
	 *
	 * @param formData
	 *
	 * @param formData.name
	 * チャットの名前
	 *
	 * @param formData.description
	 * チャットの概要
	 *
	 * @param formData.icon_preset
	 * チャットのアイコンの種類
	 */
	async putRoom(
		roomId: number,
		formData: { name: string; description: string; icon_preset: string },
	): Promise<RoomPutResponse> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		const formParams = new URLSearchParams(
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}`,
			{
				method: "put",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`DELETE`（削除）](https://developer.chatwork.com/reference/delete-rooms-room_id)
	 * グループチャットを退席、または削除します。
	 * グループチャットを退席すると、このグループチャットにある自分が担当のタスク、および自分が送信したファイルがすべて削除されます。
	 * グループチャットを削除すると、このグループチャットにあるメッセージ、タスク、ファイルがすべて削除されます。
	 * **（一度削除すると元に戻せません。）**
	 *
	 * @param roomId ルームID
	 *
	 * @param formData
	 *
	 * @param formData.action_type 操作の種類
	 * - `leave` → 退席
	 * - `delete` → 削除
	 */
	async deleteRooms(
		roomId: number,
		formData: { action_type: "leave" | "delete" },
	): Promise<void> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!formData.action_type) {
			throw new MissingParameterError("formData.action_type");
		}

		const formParams = new URLSearchParams(
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}`,
			{
				method: "delete",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id-members)
	 * チャットのメンバー一覧を取得します。
	 *
	 * @param roomId ルームID
	 */
	async getRoomMembers(roomId: number): Promise<RoomMember[]> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/members`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`PUT`（更新・変更）](https://developer.chatwork.com/reference/put-rooms-room_id-members)
	 * チャットのメンバーを一括で変更します。
	 *
	 * @param roomId ルームID
	 *
	 * @param formData
	 *
	 * @param formData.members_admin_ids
	 * **管理者**権限にしたいユーザーの一覧。
	 * コンタクト済みもしくは組織内のユーザーのアカウントIDをカンマ区切りで指定してください。
	 * 少なくとも1人以上のユーザーを指定する必要があります。
	 *
	 * @param formData.members_member_ids
	 * **メンバー**権限にしたいユーザーの一覧。
	 * コンタクト済みもしくは組織内のユーザーのアカウントIDをカンマ区切りで指定してください。
	 *
	 * @param formData.members_readonly_ids
	 * **閲覧のみ**権限にしたいユーザーの一覧。
	 * コンタクト済みもしくは組織内のユーザーのアカウントIDをカンマ区切りで指定してください。
	 */
	async putRoomMembers(
		roomId: number,
		formData: {
			members_admin_ids: string | (string | number)[];
			members_member_ids: string | (string | number)[];
			members_readonly_ids: string | (string | number)[];
		},
	): Promise<RoomMembersPutResponse> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!formData.members_admin_ids) {
			throw new MissingParameterError("formData.members_admin_ids");
		}

		if (Array.isArray(formData.members_admin_ids)) {
			console.log(
				"Joining members_admin_ids into comma-separated string...",
			);
			formData.members_admin_ids = formData.members_admin_ids.join(",");
		}
		if (Array.isArray(formData.members_member_ids)) {
			console.log(
				"Joining members_member_ids into comma-separated string...",
			);
			formData.members_member_ids = formData.members_member_ids.join(",");
		}
		if (Array.isArray(formData.members_readonly_ids)) {
			console.log(
				"Joining members_readonly_ids into comma-separated string...",
			);
			formData.members_readonly_ids = formData.members_readonly_ids.join(
				",",
			);
		}

		const formParams = new URLSearchParams(
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/members`,
			{
				method: "put",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id-messages)
	 * チャットのメッセージ一覧を最大100件まで取得します。
	 *
	 * @param roomId ルームID
	 *
	 * @param queryParams
	 *
	 * @param queryParams.force
	 * 強制的に最大件数まで取得するかどうか。
	 * `false`を指定した場合（既定）は前回取得分からの差分のみを返しますが、
	 * `true`を指定した場合は強制的に最新のメッセージを最大100件まで取得します。
	 */
	async getRoomMessages(
		roomId: number,
		queryParams: { force: boolean },
	): Promise<Message[]> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		// @ts-expect-error can't handle the in-place type mutation
		queryParams.force = queryParams.force ? "1" : "0";
		const queryString = queryStringFromParamsObject(queryParams);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/messages${queryString}`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`POST`（投稿・追加）](https://developer.chatwork.com/reference/post-rooms-room_id-messages)
	 * チャットに新しいメッセージを投稿します。
	 *
	 * @param roomId
	 * ルームID
	 *
	 * @param formData
	 *
	 * @param formData.body
	 * メッセージ本文
	 *
	 * @param formData.self_unread
	 * 投稿するメッセージを自分から見て未読にするか。
	 * `false`を指定した場合（既定）は既読、`true`を指定した場合は未読にします。
	 */
	async postRoomMessage(
		roomId: number,
		formData: { body: string; self_unread: boolean },
	): Promise<UpdatedMessage> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!formData.body) {
			throw new MissingParameterError("formData.body");
		}

		// @ts-expect-error can't handle the in-place type mutation
		formData.self_unread = formData.self_unread ? "1" : "0";
		const formParams = new URLSearchParams(
			// @ts-expect-error can't track the previous in-place type mutation
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/messages`,
			{
				method: "post",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`PUT`（更新・変更）](https://developer.chatwork.com/reference/put-rooms-room_id-messages-read)
	 * チャットのメッセージを既読にします。
	 *
	 * @param roomId ルームID
	 *
	 * @param formData
	 *
	 * @param formData.message_id
	 * 既読にするメッセージのID。
	 * ここで指定したIDまでのメッセージを既読にします。すでに既読になっている場合は400エラーを返します。
	 */
	async putRoomMessagesRead(
		roomId: number,
		formData: { message_id: string },
	): Promise<RoomMessagesReadPutResponse> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		const formParams = new URLSearchParams(
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/messages/read`,
			{
				method: "put",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "メッセージ");
		}

		return await res.json();
	}

	/**
	 * [`PUT`（更新・変更）](https://developer.chatwork.com/reference/put-rooms-room_id-messages-unread)
	 * チャットのメッセージを未読にします。
	 *
	 * @param roomId ルームID
	 *
	 * @param formData
	 *
	 * @param formData.message_id
	 * 未読にするメッセージのID。
	 * ここで指定したID以降のメッセージを未読にします。すでに未読になっている場合は400エラーを返します。
	 */
	async putRoomMessagesUnread(
		roomId: number,
		formData: { message_id: string },
	): Promise<RoomMessagesUnreadPutResponse> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!formData.message_id) {
			throw new MissingParameterError("formData.message_id");
		}

		const formParams = new URLSearchParams(
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/messages/unread`,
			{
				method: "put",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "メッセージ");
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id-messages-message_id)
	 * チャットのメッセージを取得します。
	 *
	 * @param roomId
	 * ルームID
	 *
	 * @param messageId
	 * メッセージID
	 */
	async getRoomMessage(roomId: number, messageId: number): Promise<Message> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!messageId) {
			throw new MissingParameterError("messageId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/messages/${messageId}`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "メッセージ");
		}

		return await res.json();
	}

	/**
	 * [`PUT`（更新・変更）](https://developer.chatwork.com/reference/put-rooms-room_id-messages-message_id)
	 * チャットのメッセージを変更します。
	 *
	 * @param roomId ルームID
	 *
	 * @param messageId メッセージID
	 *
	 * @param formData
	 *
	 * @param formData.body
	 * 更新するメッセージ本文
	 */
	async putRoomMessage(
		roomId: number,
		messageId: number,
		formData: { body: string },
	): Promise<UpdatedMessage> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!messageId) {
			throw new MissingParameterError("messageId");
		}
		if (!formData.body) {
			throw new MissingParameterError("formData.body");
		}

		const formParams = new URLSearchParams(
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/messages/${messageId}`,
			{
				method: "put",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "メッセージ");
		}

		return await res.json();
	}

	/**
	 * [`DELETE`（削除）](https://developer.chatwork.com/reference/delete-rooms-room_id-messages-message_id)
	 * チャットのメッセージを削除します。
	 *
	 * @param roomId ルームID
	 *
	 * @param messageId メッセージID
	 */
	async deleteRoomMessage(
		roomId: number,
		messageId: number,
	): Promise<UpdatedMessage> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!messageId) {
			throw new MissingParameterError("messageId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/messages/${messageId}`,
			{
				method: "delete",
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "メッセージ");
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id-tasks)
	 * チャットのタスク一覧を最大100件まで取得します。
	 *
	 * @param roomId ルームID
	 *
	 * @param queryParams
	 * **任意**
	 * 取得したデータをカスタマイズするためのパラメータを含むオブジェクト。
	 *
	 * @param queryParams.account_id
	 * **任意**
	 *
	 * @param queryParams.assigned_by_account_id
	 * **任意**
	 *
	 * @param queryParams.status
	 * **任意**
	 */
	async getRoomTasks(
		roomId: number,
		queryParams: {
			account_id?: number;
			assigned_by_account_id?: string | number;
			status?: TaskStatus;
		},
	): Promise<Task[]> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		queryParams.status = queryParams.status?.trim()
			.toLowerCase() as TaskStatus;
		if (!isValidTaskStatus(queryParams.status)) {
			console.warn(
				`Unknown task status "${queryParams.status}", using default (undefined)`,
			);
			delete queryParams.status;
		}
		const queryString = queryStringFromParamsObject(queryParams);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/tasks${queryString}`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`POST`（投稿・追加）](https://developer.chatwork.com/reference/post-rooms-room_id-tasks)
	 * チャットに新しいタスクを追加します。
	 *
	 * @param roomId
	 * ルームID
	 *
	 * @param formData
	 *
	 * @param formData.body
	 * タスクの内容
	 *
	 * @param formData.to_ids
	 * 担当者にしたいユーザーの一覧。
	 * チャットに所属しているユーザーのアカウントIDを指定してください。
	 *
	 * @param formData.limit
	 * **任意**
	 *
	 * タスクの期限。
	 * Unix時間（秒）で指定してください。（`date.getTime() / 1000`）
	 *
	 * @param formData.limit_type
	 * **任意**
	 *
	 * タスクの期限の種類。
	 * - `none`を指定した場合は期限なしのタスクを作成します。`formData.limit`が**未定義**の場合のデフォルト値です。
	 * - `date`を指定した場合は日付期限のタスクを作成します。`formData.limit`が**時=0と分=0と秒=0**に設定されている場合のデフォルト値です。
	 * - `time`を指定した場合は時間期限のタスクを作成します。`formData.limit`に**時とか分とか秒が指定された**場合のデフォルト値です。
	 */
	async postRoomTasks(
		roomId: number,
		formData: {
			body: string;
			to_ids: string | (string | number)[];
			limit?: Date | number | string;
			limit_type?: TaskLimitType;
		},
	): Promise<PostTasksResponse> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!formData.body) {
			throw new MissingParameterError("formData.body");
		}
		if (!formData.to_ids) {
			throw new MissingParameterError("formData.to_ids");
		}
		if (formData.limit && !(formData.limit instanceof Date)) {
			if (
				typeof formData.limit === "string" ||
				typeof formData.limit === "number"
			) {
				formData.limit = new Date(formData.limit);
			}
			if (!(formData.limit instanceof Date)) {
				throw new InvalidParameterError(
					"formData.limit",
					typeof formData.limit,
					"Dateオブジェクト",
				);
			}
		}

		if (!formData.limit_type) {
			if (!formData.limit) {
				formData.limit_type = "none";
			} else if (
				(formData.limit as Date).getSeconds() === 0 &&
				(formData.limit as Date).getMinutes() === 0 &&
				(formData.limit as Date).getHours() === 0
			) {
				formData.limit_type = "date";
			} else {
				formData.limit_type = "time";
			}
		} else {
			formData.limit_type = formData.limit_type.trim()
				.toLowerCase() as TaskLimitType;
		}

		if (!isValidLimitType(formData.limit_type)) {
			throw new InvalidParameterError(
				"formData.limit_type",
				formData.limit_type,
				'"none" または "date" または "time"',
			);
		}

		if (Array.isArray(formData.to_ids)) {
			console.log("Joining to_ids into comma-separated string...");
			formData.to_ids = formData.to_ids.join(",");
		}

		if (formData.limit) {
			// chatwork requires unix seconds
			// @ts-expect-error can't handle the in-place type mutation
			formData.limit = Math.floor(formData.limit.getTime() / 1000)
				.toString();
		}

		const formParams = new URLSearchParams(
			// @ts-expect-error can't track the previous in-place type mutation
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/tasks`,
			{
				method: "post",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id-tasks-task_id)
	 * チャットのタスクの情報を取得します。
	 *
	 * @param roomId
	 * ルームID
	 *
	 * @param taskId
	 * タスクID
	 */
	async getRoomTask(roomId: number, taskId: number): Promise<Task> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!taskId) {
			throw new MissingParameterError("taskId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/tasks/${taskId}`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "タスク");
		}

		return await res.json();
	}

	/**
	 * [`PUT`（更新・変更）](https://developer.chatwork.com/reference/put-rooms-room_id-tasks-task_id-status)
	 * チャットのタスクの完了状態を変更します。
	 *
	 * @param roomId
	 * ルームID
	 *
	 * @param taskId
	 * タスクID
	 *
	 * @param formData
	 *
	 * @param formData.body タスクの完了状態。
	 * - `done`を指定した場合はタスクを完了にします。
	 * - `open`を指定した場合はタスクを未完了にします。
	 */
	async putRoomTaskStatus(
		roomId: number,
		taskId: number,
		formData: { body: TaskStatus },
	): Promise<TaskIdResponse> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!taskId) {
			throw new MissingParameterError("taskId");
		}

		formData.body = formData.body?.trim().toLowerCase() as TaskStatus;
		if (!formData.body) {
			throw new MissingParameterError("formData.body");
		} else if (!isValidTaskStatus(formData.body)) {
			throw new InvalidParameterError(
				"formData.body",
				formData.body,
				'"done" または "open"',
			);
		}

		const formParams = new URLSearchParams(
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/tasks/${taskId}/status`,
			{
				method: "put",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "タスク");
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id-files)
	 * チャットのファイル一覧を最大100件まで取得します。
	 *
	 * @param roomId
	 * ルームID
	 *
	 * @param queryParams
	 * **任意**
	 *
	 * 取得したデータをカスタマイズするためのパラメータを含むオブジェクト。
	 *
	 * @param queryParams.account_id
	 * **任意**
	 *
	 * アップロードしたユーザーのアカウントID
	 */
	async getRoomFiles(
		roomId: number,
		queryParams: { account_id?: number },
	): Promise<File[]> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		const queryString = queryStringFromParamsObject(queryParams);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/files${queryString}`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`POST`（投稿・追加）](https://developer.chatwork.com/reference/post-rooms-room_id-files)
	 * チャットに新しいファイルをアップロードします。
	 *
	 * @param roomId ルームID
	 *
	 * @param formData
	 *
	 * @param formData.file
	 * アップロードするファイルのバイナリ。
	 * ファイルサイズの上限は5MBです。
	 *
	 * @param formData.message
	 */
	async postRoomFiles(
		roomId: number,
		formData: { file: Blob | Uint8Array; message: string },
	): Promise<UploadedFiles> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!formData.file) {
			throw new MissingParameterError("formData.file");
		}

		const formParams = new FormData();
		formParams.append("message", formData.message);
		const blob = formData.file instanceof Uint8Array
			? new Blob([formData.file])
			: formData.file;
		formParams.append("file", blob);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/files`,
			{
				method: "post",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id-files-file_id)
	 * チャットのファイルの情報を取得します。
	 *
	 * @param roomId ルームID
	 *
	 * @param fileId ファイルID
	 *
	 * @param queryParams
	 * **任意**
	 *
	 * 取得したデータをカスタマイズするためのパラメータを含むオブジェクト。
	 *
	 * @param queryParams.create_download_url
	 * **任意**
	 *
	 * ダウンロードURLを作成するか。
	 * 作成されるダウンロードURLは30秒間のみ有効です。
	 */
	async getRoomFile(
		roomId: number,
		fileId: number,
		queryParams: { create_download_url?: boolean },
	): Promise<DownloadableFile> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}
		if (!fileId) {
			throw new MissingParameterError("fileId");
		}

		if (queryParams.create_download_url !== undefined) {
			// @ts-expect-error can't handle the in-place type mutation
			queryParams.create_download_url = queryParams.create_download_url
				? "1"
				: "0";
		}
		const queryString = queryStringFromParamsObject(queryParams);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/files/${fileId}${queryString}`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "ファイル");
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-rooms-room_id-link)
	 * チャットへの招待リンクを取得します。
	 *
	 * @param roomId ルームID
	 */
	async getRoomLink(roomId: number): Promise<RoomInvitationLink> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/link`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`POST`（投稿・追加）](https://developer.chatwork.com/reference/post-rooms-room_id-link)
	 * チャットへの招待リンクを変更します。
	 * 招待リンクが無効になっている場合は400エラーを返します。
	 *
	 * @param roomId
	 * ルームID
	 *
	 * @param formData
	 *
	 * @param formData.code
	 * 招待リンクのパス部分。省略するとランダムな文字列となります。
	 *
	 * @param formData.need_acceptance
	 * 参加に管理者の承認を必要とするか
	 *
	 * @param formData.description
	 * 招致リンクのページに表示される説明文
	 */
	async postRoomLink(
		roomId: number,
		formData: {
			code: string;
			need_acceptance: boolean;
			description: string;
		},
	): Promise<RoomInvitationLink> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		// @ts-expect-error can't handle the in-place type mutation
		formData.need_acceptance = formData.need_acceptance ? "1" : "0";

		const formParams = new URLSearchParams(
			// @ts-expect-error can't track the previous in-place type mutation
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/link`,
			{
				method: "post",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`PUT`（更新・変更）](https://developer.chatwork.com/reference/put-rooms-room_id-link)
	 * チャットへの招待リンクを変更します。
	 * 招待リンクが無効になっている場合は400エラーを返します。
	 *
	 * @param roomId ルームID
	 *
	 * @param formData
	 *
	 * @param formData.code
	 * 招待リンクのパス部分。
	 * 省略するとランダムな文字列となります。
	 *
	 * @param formData.need_acceptance
	 * 参加に管理者の承認を必要とするか
	 *
	 * @param formData.description
	 * 招致リンクのページに表示される説明文
	 */
	async putRoomLink(
		roomId: number,
		formData: {
			code: string;
			need_acceptance: boolean;
			description: string;
		},
	): Promise<RoomInvitationLink> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		// @ts-expect-error can't handle the in-place type mutation
		formData.need_acceptance = formData.need_acceptance ? "1" : "0";

		const formParams = new URLSearchParams(
			// @ts-expect-error can't track the previous in-place type mutation
			Object.entries(formData).map(entryValuesAsStrings),
		);

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/link`,
			{
				method: "put",
				headers: this.#FormDataHeaders,
				body: formParams,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`DELETE`（削除）](https://developer.chatwork.com/reference/delete-rooms-room_id-link)
	 * チャットへの招待リンクを削除します。
	 * 招待リンクが無効になっている場合は400エラーを返します。
	 *
	 * @param roomId ルームID
	 */
	async deleteRoomLink(roomId: number): Promise<RoomInvitationLink> {
		if (!roomId) {
			throw new MissingParameterError("roomId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/rooms/${roomId}/link`,
			{
				method: "delete",
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`GET`（取得）](https://developer.chatwork.com/reference/get-incoming_requests)
	 * 自分へのコンタクト承認依頼一覧を最大100件まで取得します。
	 */
	async getIncomingRequests(): Promise<ContactRequest[]> {
		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/incoming_requests`,
			{
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status);
		}

		return await res.json();
	}

	/**
	 * [`PUT`（更新・変更）](https://developer.chatwork.com/reference/put-incoming_requests-request_id)
	 * 自分へのコンタクト承認依頼を`承認`します。
	 *
	 * @param requestId
	 * リクエストID
	 */
	async putIncomingRequests(
		requestId: number,
	): Promise<ContactRequestApprovalResponse> {
		if (!requestId) {
			throw new MissingParameterError("requestId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/incoming_requests/${requestId}`,
			{
				method: "put",
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "コンタクト");
		}

		return await res.json();
	}

	/**
	 * [`DELETE`（削除）](https://developer.chatwork.com/reference/delete-incoming_requests-request_id)
	 * 自分へのコンタクト承認依頼を`拒否`します。
	 *
	 * @param requestId リクエストID
	 */
	async deleteIncomingRequest(requestId: number): Promise<void> {
		if (!requestId) {
			throw new MissingParameterError("requestId");
		}

		const res = await this.#fetch(
			`${ChatworkClient.#apiV2Endpoint}/incoming_requests/${requestId}`,
			{
				method: "delete",
				headers: this.#DefaultHeaders,
			},
		);

		if (!res.ok) {
			throw new ChatworkError(res.status, "コンタクト");
		}
	}
}

const validTaskStatusRe = /^(open|done)$/;
function isValidTaskStatus(taskStatus?: string): taskStatus is TaskStatus {
	if (!taskStatus) {
		return false;
	}
	return validTaskStatusRe.test(taskStatus);
}

const validLimitTypeRe = /^(none|date|time)$/;
function isValidLimitType(
	taskLimitType: string,
): taskLimitType is TaskLimitType {
	if (!taskLimitType) {
		return false;
	}
	return validLimitTypeRe.test(taskLimitType);
}

/**
 * @param queryParams
 * **任意**
 */
function queryStringFromParamsObject(queryParams?: {
	[key: string]: string | number | boolean;
}) {
	if (!queryParams) {
		return "";
	}
	const definedParams = [];
	for (const [key, val] of Object.entries(queryParams)) {
		if (val === undefined || val === null) {
			continue;
		}
		definedParams.push(`${key}=${val}`);
	}

	const queryString = definedParams.length > 0
		? "?" + definedParams.join("&")
		: "";

	return queryString;
}

class ChatworkError extends Error {
	/**
	 * @arg statusCode
	 * @arg resourceType
	 * **任意**
	 */
	constructor(
		statusCode: number,
		resourceType:
			| "メッセージ"
			| "タスク"
			| "ファイル"
			| "コンタクト"
			| "リソース" = "リソース",
	) {
		let msg: string, name: string;
		switch (statusCode) {
			case 400:
				msg =
					"リクエストまたはアクセストークンのパラメーターが不足している、および不正な値が指定されている";
				name = "IncorrectParametersError";
				break;
			case 401:
				msg = "認証に失敗した";
				name = "UnauthorizedError";
				break;
			case 403:
				msg = "アクセストークンのスコープが不足している";
				name = "ForbiddenError";
				break;
			case 404:
				msg = `${resourceType}が存在しない`;
				name = "NotFoundError";
				break;
			case 429:
				msg = "APIの利用回数制限を超過した";
				name = "RateLimitError";
				break;
			default:
				msg = "不明なエラー";
				name = `UnknownChatworkError ${statusCode}`;
		}
		super(msg);
		super.name = name;
	}
}

function entryValuesAsStrings([key, val]: [
	string,
	string | number | (string | number)[],
]) {
	return [key, Array.isArray(val) ? val.join(",") : String(val)];
}

class MissingParameterError extends Error {
	constructor(missingParam: string) {
		super(`${missingParam} は必須パラメータです。`);
	}
}

class InvalidParameterError extends Error {
	/**
	 * @arg invalidParam
	 * @arg paramVal
	 * @arg expectedParamVal
	 */
	constructor(
		invalidParam: string,
		paramVal: string,
		expectedParamVal: string,
	) {
		super(
			`${invalidParam} が ${paramVal} となっているが、 ${expectedParamVal} とすべきである。`,
		);
	}
}

interface TaskIdResponse {
	task_id: string;
}

type TaskStatus = "open" | "done";

type TaskLimitType = "none" | "date" | "time";

type BuiltInChatworkIcon =
	| "group"
	| "check"
	| "document"
	| "meeting"
	| "event"
	| "project"
	| "business"
	| "study"
	| "security"
	| "star"
	| "idea"
	| "heart"
	| "magcup"
	| "beer"
	| "music"
	| "sports"
	| "travel";

interface Me {
	account_id: number;
	room_id: number;
	name: string;
	chatwork_id: string;
	organization_id: number;
	organization_name: string;
	department: string;
	title: string;
	url: string;
	introduction: string;
	mail: string;
	tel_organization: string;
	tel_extension: string;
	tel_mobile: string;
	skype: string;
	facebook: string;
	twitter: string;
	avatar_image_url: string;
	login_mail: string;
}

interface MyStatus {
	unread_room_num: number;
	mention_room_num: number;
	mytask_room_num: number;
	unread_num: number;
	mention_num: number;
	mytask_num: number;
}

interface TaskRoom {
	room_id: number;
	name: string;
	icon_path: string;
}

type MyTask = Omit<Task, "account"> & { room: TaskRoom };

interface Contact {
	account_id: number;
	room_id: number;
	name: string;
	chatwork_id: string;
	organization_id: number;
	organization_name: string;
	department: string;
	avatar_image_url: string;
}

interface RoomInfo {
	room_id: number;
	name: string;
	type: "my" | "direct" | "group";
	role: "admin" | "member" | "readonly";
	sticky: boolean;
	unread_num: number;
	mention_num: number;
	mytask_num: number;
	message_num: number;
	file_num: number;
	task_num: number;
	icon_path: string;
	last_update_time: number;
}

interface RoomsPostResponse {
	room_id: number;
}

type RoomInfoWithDescription = RoomInfo & { description: string };

interface RoomPutResponse {
	room_id: number;
}

interface RoomMember {
	account_id: number;
	role: "admin" | "member" | "readonly";
	name: string;
	chatwork_id: string;
	organization_id: number;
	organization_name: string;
	department: string;
	avatar_image_url: string;
}

interface RoomMembersPutResponse {
	admin: number[];
	member: number[];
	readonly: number[];
}

interface Message {
	message_id: string;
	account: AccountInfo;
	body: string;
	send_time: number;
	update_time: number;
}

interface UpdatedMessage {
	message_id: string;
}

interface RoomMessagesReadPutResponse {
	unread_num: number;
	mention_num: number;
}

interface RoomMessagesUnreadPutResponse {
	unread_num: number;
	mention_num: number;
}

interface AccountInfo {
	account_id: number;
	name: string;
	avatar_image_url: string;
}

interface Task {
	task_id: number;
	account: AccountInfo;
	assigned_by_account: AccountInfo;
	message_id: string;
	body: string;
	limit_time: number;
	status: TaskStatus;
	limit_type: TaskLimitType;
}

interface PostTasksResponse {
	task_ids: number[];
}

interface File {
	file_id: number;
	account: AccountInfo;
	message_id: string;
	filename: string;
	filesize: number;
	upload_time: number;
}

type UploadedFiles = { file_ids: string[] };

interface Downloadable {
	download_url?: string;
}

type DownloadableFile = File & Downloadable;

interface RoomInvitationLink {
	public: boolean;
	url: string;
	need_acceptance: boolean;
	description: string;
}

interface ContactRequest {
	request_id: number;
	account_id: number;
	message: string;
	name: string;
	chatwork_id: string;
	organization_id: number;
	organization_name: string;
	department: string;
	avatar_image_url: string;
}

type ContactRequestApprovalResponse = Omit<ContactRequest, "request_id">;
