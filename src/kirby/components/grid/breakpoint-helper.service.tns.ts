import { Injectable, NgZone } from '@angular/core';
import { screen } from 'platform';
import { OrientationChangedEventData } from 'application';
import * as app from 'application';

@Injectable({
  providedIn: 'root'
})
export class BreakpointHelperService {
  currentScreenWidth: number;

  constructor(private zone: NgZone) { }

  onInit(callback: () => void) {
    this.currentScreenWidth = screen.mainScreen.widthDIPs;
    app.on(app.orientationChangedEvent, (args: OrientationChangedEventData) => {
      if (this.currentScreenWidth === screen.mainScreen.widthDIPs) {
        this.currentScreenWidth = screen.mainScreen.heightDIPs;
      } else {
        this.currentScreenWidth = screen.mainScreen.widthDIPs;
      }
      this.zone.run(() => {
      callback();
      });
    });
  }

}
