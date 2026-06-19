import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

function buildMessageData(messageRowId: number, receivedAt: number, title: string, isRead: number): CoreType.MessageData
{
    const messageData: CoreType.MessageData =
    {
        messagePreview:
        {
            messageRowId: messageRowId,
            receivedAt: receivedAt,
            title: title,
            isRead: isRead,
            type: MessageData.MessageType.Admin,
        },
        messageRow: null,
    };

    return messageData;
}

describe("messageData — computeUnreadMessageCount", () =>
{
    it("counts only previews with isRead === 0", () =>
    {
        const messageDatas: CoreType.MessageData[] =
        [
            buildMessageData(1, 100, "a", 0),
            buildMessageData(2, 200, "b", 1),
            buildMessageData(3, 300, "c", 0),
        ];
        expect(MessageData.computeUnreadMessageCount(messageDatas)).toBe(2);
    });

    it("returns 0 for an empty list", () =>
    {
        expect(MessageData.computeUnreadMessageCount([])).toBe(0);
    });
});

describe("messageData — buildVisibleMessageDatas", () =>
{
    it("sorts by receivedAt descending", () =>
    {
        const messageDatas: CoreType.MessageData[] =
        [
            buildMessageData(1, 100, "old", 0),
            buildMessageData(2, 300, "new", 0),
            buildMessageData(3, 200, "mid", 0),
        ];

        const visible: CoreType.MessageData[] = MessageData.buildVisibleMessageDatas(messageDatas, new Set<number>());
        expect(visible.map((messageData: CoreType.MessageData): number => messageData.messagePreview.messageRowId)).toEqual([2, 3, 1]);
    });

    it("filters out deleted message row ids", () =>
    {
        const messageDatas: CoreType.MessageData[] =
        [
            buildMessageData(1, 100, "old", 0),
            buildMessageData(2, 300, "new", 0),
            buildMessageData(3, 200, "mid", 0),
        ];

        const visible: CoreType.MessageData[] = MessageData.buildVisibleMessageDatas(messageDatas, new Set<number>([2]));
        expect(visible.map((messageData: CoreType.MessageData): number => messageData.messagePreview.messageRowId)).toEqual([3, 1]);
    });

    it("caps the result at MAX_VISIBLE_MESSAGES", () =>
    {
        const messageDatas: CoreType.MessageData[] = Array.from({ length: MessageData.MAX_VISIBLE_MESSAGES + 10 }, (unused: unknown, index: number): CoreType.MessageData =>
        {
            return buildMessageData(index + 1, index + 1, `title ${index}`, 0);
        });

        const visible: CoreType.MessageData[] = MessageData.buildVisibleMessageDatas(messageDatas, new Set<number>());
        expect(visible.length).toBe(MessageData.MAX_VISIBLE_MESSAGES);
    });
});

describe("messageData — doMessagePreviewsMatch", () =>
{
    it("matches on identical receivedAt and title regardless of id", () =>
    {
        const predicted: CoreType.MessagePreview = buildMessageData(-1, 500, "Fleet arrived", 0).messagePreview;
        const persisted: CoreType.MessagePreview = buildMessageData(42, 500, "Fleet arrived", 0).messagePreview;
        expect(MessageData.doMessagePreviewsMatch(predicted, persisted)).toBe(true);
    });

    it("does not match when title or receivedAt differ", () =>
    {
        const base: CoreType.MessagePreview = buildMessageData(1, 500, "Fleet arrived", 0).messagePreview;
        const differentTitle: CoreType.MessagePreview = buildMessageData(2, 500, "Fleet destroyed", 0).messagePreview;
        const differentTime: CoreType.MessagePreview = buildMessageData(3, 600, "Fleet arrived", 0).messagePreview;

        expect(MessageData.doMessagePreviewsMatch(base, differentTitle)).toBe(false);
        expect(MessageData.doMessagePreviewsMatch(base, differentTime)).toBe(false);
    });
});

describe("messageData — findMessageDataByMessageRowId", () =>
{
    it("returns the matching message data", () =>
    {
        const target: CoreType.MessageData = buildMessageData(2, 200, "b", 0);
        const messageDatas: CoreType.MessageData[] =
        [
            buildMessageData(1, 100, "a", 0),
            target,
        ];
        expect(MessageData.findMessageDataByMessageRowId(messageDatas, 2)).toBe(target);
    });

    it("returns null when no message matches", () =>
    {
        const messageDatas: CoreType.MessageData[] = [buildMessageData(1, 100, "a", 0)];
        expect(MessageData.findMessageDataByMessageRowId(messageDatas, 999)).toBeNull();
    });
});
