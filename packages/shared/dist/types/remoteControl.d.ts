export interface ScreenStreamConfig {
    fps?: number;
    quality?: number;
    scale?: number;
}
export type RemoteInputAction = 'mouse_move' | 'mouse_click' | 'mouse_down' | 'mouse_up' | 'mouse_scroll' | 'key_press' | 'type_text';
export interface RemoteInputPayload {
    action: RemoteInputAction;
    x?: number;
    y?: number;
    button?: 'left' | 'right' | 'middle' | 'double';
    delta?: number;
    key?: string;
    text?: string;
}
export interface ScreenFramePayload {
    frame: string;
    width: number;
    height: number;
    timestamp: number;
}
//# sourceMappingURL=remoteControl.d.ts.map