import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { useSignalREvents } from '../hooks/useSignalREvents';
import { TopbarProvider } from '../context/TopbarContext';
import { useColumns } from '../hooks/useColumns';
import { useCards } from '../hooks/useCards';

function broadcast(eventName, payload) {
    const registration = vi.mocked(useSignalREvents).mock.calls.find(([options]) => options.eventName === eventName);
    registration[0].handler(payload);
}

beforeEach(() => {
    vi.mocked(useSignalREvents).mockClear();
    api.post.mockReset();
});

describe('realtime creation', () => {
    it('shows a column once when its event arrives before the API response', async () => {
        const column = { id: 7, name: 'To Do', position: 0, color: '#00d4ff' };
        let resolvePost;
        api.post.mockReturnValueOnce(new Promise(resolve => { resolvePost = resolve; }));

        const { result } = renderHook(() => {
            const [board, setBoard] = useState({ columns: [] });
            return { board, columns: useColumns(1, board, setBoard, {}) };
        });

        act(() => result.current.columns.setColumnName('To Do'));
        let request;
        act(() => { request = result.current.columns.handleCreateColumn({ preventDefault() {} }); });
        act(() => broadcast('ColumnCreated', { column }));
        await act(async () => { resolvePost({ data: column }); await request; });

        expect(result.current.board.columns).toHaveLength(1);
    });

    it('shows a card once when its event arrives before the API response', async () => {
        const card = { id: 11, title: 'Audit Card', columnId: 7 };
        let resolvePost;
        api.post.mockReturnValueOnce(new Promise(resolve => { resolvePost = resolve; }));

        const { result } = renderHook(() => {
            const [board, setBoard] = useState({ columns: [{ id: 7, cards: [] }] });
            return { board, cards: useCards(1, board, setBoard, vi.fn(), {}) };
        }, { wrapper: TopbarProvider });

        let request;
        act(() => { request = result.current.cards.handleCreateCard(7, 'Audit Card'); });
        act(() => broadcast('CardCreated', { card, columnId: 7 }));
        await act(async () => { resolvePost({ data: card }); await request; });

        expect(result.current.board.columns[0].cards).toHaveLength(1);
    });
});
