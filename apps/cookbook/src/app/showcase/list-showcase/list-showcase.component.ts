import { Component, OnInit } from '@angular/core';
import { ListColoredItemsExampleTemplate } from '~/app/examples/list-example/examples/colored-items';
import { ListWithDividersExampleTemplate } from '~/app/examples/list-example/examples/dividers';
import { ListWithHeaderAndFooterExampleTemplate } from '~/app/examples/list-example/examples/header-and-footer';
import { ListWithSectionsExampleTemplate } from '~/app/examples/list-example/examples/sections';
import { ListWithSectionsAndColoredItemsExampleTemplate } from '~/app/examples/list-example/examples/sections-and-colored-items';
import { ListSelectableItemsExampleTemplate } from '~/app/examples/list-example/examples/selectable-items';

import { ListItemsExampleTemplate } from '../../examples/list-example/examples/items';
import exampleHtml from '../../examples/list-example/list-example.component.html?raw';

@Component({
  selector: 'cookbook-list-showcase',
  templateUrl: './list-showcase.component.html',
  styleUrls: ['./list-showcase.component.scss'],
})
export class ListShowcaseComponent implements OnInit {
  dividersExampleTemplate: string = ListWithDividersExampleTemplate;
  selectableItemsExampleTemplate: string = ListSelectableItemsExampleTemplate;
  coloredItemsExampleTemplate: string = ListColoredItemsExampleTemplate;
  sectionsAndColoredItemsExampleTemplate: string = ListWithSectionsAndColoredItemsExampleTemplate;
  headerAndFooterExampleTemplate: string = ListWithHeaderAndFooterExampleTemplate;
  sectionsExampleTemplate: string = ListWithSectionsExampleTemplate;
  items: string = ListItemsExampleTemplate;

  exampleHtml = exampleHtml;

  sectionHeaderExampleHtml: string =
    '<GridLayout *kirbyListSectionHeader="let section" ios:height="50">...</GridLayout>';
  constructor() {}

  ngOnInit() {}
}
