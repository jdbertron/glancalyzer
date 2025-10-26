declare module 'webgazer' {
  interface GazeData {
    x: number
    y: number
    confidence?: number
  }

  interface WebGazer {
    setRegression(type: string): WebGazer
    setTracker(type: string): WebGazer
    setGazeListener(callback: (data: GazeData | null, clock: any) => void): WebGazer
    saveDataAcrossSessions(save: boolean): WebGazer
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
