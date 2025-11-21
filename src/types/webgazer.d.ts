declare module 'webgazer' {
  interface GazeData {
    x: number
    y: number
    confidence?: number
  }

  interface WebGazerParams {
    moveTickSize: number
    trackMouseMovements: boolean
    dataWindow: number
    videoContainerId: string
    videoElementId: string
    videoElementCanvasId: string
    faceOverlayId: string
    faceFeedbackBoxId: string
    gazeDotId: string
    videoViewerWidth: number
    videoViewerHeight: number
    faceFeedbackBoxRatio: number
    showVideo: boolean
    mirrorVideo: boolean
    showFaceOverlay: boolean
    showFaceFeedbackBox: boolean
    frameSkipRate: number
    showGazeDot: boolean
    camConstraints: any
    dataTimestep: number
    showVideoPreview: boolean
    applyKalmanFilter: boolean
    saveDataAcrossSessions: boolean
    storingPoints: boolean
    trackEye: string
  }

  interface WebGazer {
    params: WebGazerParams
    setRegression(type: string): WebGazer
    setTracker(type: string): WebGazer
    setGazeListener(callback: (data: GazeData | null, clock: any) => void): WebGazer
    saveDataAcrossSessions(save: boolean): WebGazer
    applyKalmanFilter(enabled: boolean): WebGazer
    showVideoPreview(show: boolean): Promise<void>
    showPredictionPoints(show: boolean): Promise<void>
    begin(): Promise<void>
    pause(): Promise<void>
    end(): Promise<void>
    isReady(): boolean
    getVideoElement(): HTMLVideoElement | null
  }

  const webgazer: WebGazer
  export default webgazer
}
