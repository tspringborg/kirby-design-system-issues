import { Component, OnInit } from '@angular/core';

import exampleHtml from '../../examples/spinner-example/spinner-example.component.html?raw';

@Component({
  selector: 'cookbook-spinner-showcase',
  templateUrl: './spinner-showcase.component.html',
})
export class SpinnerShowcaseComponent implements OnInit {
  exampleHtml = exampleHtml;

  constructor() {}

  ngOnInit() {}
}
