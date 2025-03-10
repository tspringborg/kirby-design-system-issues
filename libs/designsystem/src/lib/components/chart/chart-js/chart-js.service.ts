import { ElementRef, Injectable } from '@angular/core';
import { ActiveElement, ChartConfiguration, ChartOptions, ScatterDataPoint } from 'chart.js';
import { AnnotationOptions } from 'chartjs-plugin-annotation';
import { toDate } from 'date-fns';

import { mergeDeepAll } from '../../../helpers/merge-deep';
import {
  ChartDataLabelOptions,
  ChartDataset,
  ChartHighlightedElements,
  ChartLabel,
  ChartLocale,
  ChartType,
  isNumberArray,
} from '../chart.types';
import { ChartConfigService } from '../configs/chart-config.service';

import { Chart } from './configured-chart-js';

const CHART_LOCALE_DEFAULT = 'en-US';

@Injectable()
export class ChartJSService {
  private chart: Chart;
  private dataLabelOptions: ChartDataLabelOptions;
  private highlightedElements: ChartHighlightedElements;
  private chartType: ChartType;
  private locale: ChartLocale;

  constructor(private chartConfigService: ChartConfigService) {}

  public renderChart(args: {
    targetElement: ElementRef<HTMLCanvasElement>;
    type: ChartType;
    data: ChartDataset[] | number[];
    labels?: ChartLabel[];
    customOptions?: ChartOptions;
    annotations?: AnnotationOptions[];
    dataLabelOptions?: ChartDataLabelOptions;
    highlightedElements?: ChartHighlightedElements;
  }): void {
    const {
      targetElement,
      type,
      data,
      labels,
      customOptions,
      annotations,
      dataLabelOptions,
      highlightedElements,
    } = args;

    this.dataLabelOptions = dataLabelOptions || null;
    this.highlightedElements = highlightedElements || null;
    this.chartType = type;
    this.locale = dataLabelOptions?.locale || CHART_LOCALE_DEFAULT;

    const datasets = this.createDatasets(data);

    const options = this.createOptionsObject({
      customOptions,
      annotations,
      dataLabelOptions,
    });
    let config = this.createConfigurationObject(type, datasets, options, labels);

    this.initializeNewChart(targetElement.nativeElement, config);
  }

  public redrawChart() {
    this.chart.update();
  }

  public updateData(data: ChartDataset[] | number[]): void {
    const datasets = this.createDatasets(data);

    this.chart.data.datasets = datasets;
  }

  public updateLabels(labels: ChartLabel[]) {
    /* As labels provided via the 'labels' input property always has 
    highest priority - we can just set the property directly */
    this.chart.data.labels = labels;
  }

  public updateType(type: ChartType, customOptions?: ChartOptions) {
    if (type === 'bar' || type === 'column') {
      /* indexAxis does not update predictably; update by replacing 
         the chart entirely instead */
      this.destructivelyUpdateType(type, customOptions);
    } else {
      this.nonDestructivelyUpdateType(type, customOptions);
    }
  }

  public setDataLabelOptions(dataLabelOptions: ChartDataLabelOptions) {
    this.dataLabelOptions = dataLabelOptions;
  }

  public updateOptions(customOptions: ChartOptions, type: ChartType) {
    const annotations = this.getExistingChartAnnotations();
    this.chartType = type;
    this.chart.options = this.createOptionsObject({ customOptions, annotations });
  }

  public updateAnnotations(annotations: AnnotationOptions[]) {
    const annotationsWithDefaults = this.applyDefaultsToAnnotations(annotations);
    this.chart.options.plugins.annotation.annotations = annotationsWithDefaults;
  }

  public updateHighlightedElements(highlightedElements?: ChartHighlightedElements) {
    this.highlightedElements = highlightedElements;
    const oldDatasets = this.chart.data.datasets as ChartDataset[];

    // Clear old datasets of highlighted elements
    oldDatasets.map((dataset) => {
      if (dataset?.kirbyOptions?.highlightedElements) {
        delete dataset.kirbyOptions.highlightedElements;
      }
    });

    this.chart.data.datasets = this.createDatasets(oldDatasets);
  }

  private getExistingChartAnnotations(): AnnotationOptions[] {
    const annotations = this.chart.options.plugins?.annotation?.annotations;
    /* In browser chart.js might return annotations as a Proxy object; force it to be an array.
       Each annotationOption in the resulting array  will also be a Proxy object. 
       But internally chart.js will just work with them as normal values */
    if (annotations !== undefined) {
      return Object.keys(annotations).map((key) => annotations[key]);
    } else {
      return [];
    }
  }

  private destructivelyUpdateType(type: ChartType, customOptions?: ChartOptions) {
    const datasets = this.chart.data.datasets as ChartDataset[];
    const labels = this.chart.data.labels as ChartLabel[]; // chart.js stores labels as unknown[]; cast it to ChartLabel[]
    const annotations = this.getExistingChartAnnotations();

    this.chartType = type;
    const options = this.createOptionsObject({ customOptions, annotations });
    const config = this.createConfigurationObject(type, datasets, options, labels);
    const canvasElement = this.chart.canvas;

    this.chart.destroy();
    this.initializeNewChart(canvasElement, config);
  }

  private nonDestructivelyUpdateType(chartType: ChartType, customOptions?: ChartOptions) {
    const annotations = this.getExistingChartAnnotations();
    this.chartType = chartType;
    const options = this.createOptionsObject({
      customOptions,
      annotations,
    });

    this.chart.options = options;
    this.chart.config.type = this.chartConfigService.chartTypeToChartJSType(chartType);
  }

  private initializeNewChart(canvasElement: HTMLCanvasElement, config: ChartConfiguration) {
    this.chart = new Chart(canvasElement, config);
  }

  private createBlankLabels(datasets: ChartDataset[]): string[] {
    const largestDataset = datasets.reduce((previousDataset, currentDataset) =>
      previousDataset.data.length > currentDataset.data.length ? previousDataset : currentDataset
    );
    return Array(largestDataset.data.length).fill('');
  }

  private applyDefaultsToAnnotations(annotations: AnnotationOptions[]) {
    return annotations.map((annotation) => {
      const annotationTypeDefaults = this.chartConfigService.getAnnotationDefaults(annotation.type);
      return mergeDeepAll(annotationTypeDefaults, annotation);
    });
  }

  private createAnnotationPluginOptionsObject(annotations: AnnotationOptions[]) {
    const annotationsWithDefaults = this.applyDefaultsToAnnotations(annotations);
    return {
      plugins: {
        annotation: {
          annotations: annotationsWithDefaults,
        },
      },
    };
  }

  private applyInteractionFunctionsExtensions(options: ChartOptions): ChartOptions {
    const interactionFunctionsExtensions =
      this.chartConfigService.getInteractionFunctionsExtensions();
    Object.entries(interactionFunctionsExtensions).forEach(([key, _]) => {
      const callback = options[key];
      options[key] = (e: Event, a: ActiveElement[], c: Chart) => {
        interactionFunctionsExtensions[key](e, a, c, callback);
      };
    });
    return options;
  }

  private createStockOptionsObject(dataLabelOptions: ChartDataLabelOptions) {
    return {
      locale: this.locale,
      plugins: {
        tooltip: {
          callbacks: {
            title: (tooltipItems) => {
              const date = toDate((tooltipItems[0]?.raw as any)?.x);
              if (date.valueOf()) {
                return date.toLocaleTimeString(this.locale, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              }
            },
            label: (context) => {
              // It's not possible to add spacing between color legend and text so we
              // prefix with a space.
              return ' ' + context.formattedValue + (dataLabelOptions.valueSuffix || '');
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => {
              return value + (dataLabelOptions.valueSuffix || '');
            },
          },
        },
      },
    };
  }

  private createOptionsObject(args: {
    customOptions?: ChartOptions;
    annotations?: AnnotationOptions[];
    dataLabelOptions?: ChartDataLabelOptions;
  }): ChartOptions {
    const { customOptions, annotations, dataLabelOptions: chartDataLabelOptions } = args;

    const typeConfig = this.chartConfigService.getTypeConfig(this.chartType);
    const typeConfigOptions = typeConfig?.options;
    const annotationPluginOptions = annotations
      ? this.createAnnotationPluginOptionsObject(annotations)
      : {};
    const stockOptions: ChartOptions =
      this.chartType === 'stock' ? this.createStockOptionsObject(chartDataLabelOptions) : {};

    let options: ChartOptions = mergeDeepAll(
      stockOptions,
      typeConfigOptions,
      customOptions,
      annotationPluginOptions
    );

    return this.applyInteractionFunctionsExtensions(options);
  }

  private getDefaultStockLabels(datasets: ChartDataset[], locale: ChartLocale) {
    const largestDataset = datasets.reduce((previousDataset, currentDataset) =>
      previousDataset.data.length > currentDataset.data.length ? previousDataset : currentDataset
    );
    return largestDataset.data.map((point: ScatterDataPoint) =>
      toDate(point.x).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      })
    );
  }

  private getLabelsToApply(args: {
    datasets: ChartDataset[];
    type: ChartType;
    indexAxis: 'x' | 'y';
    labels?: ChartLabel[];
  }) {
    const { datasets, labels, type, indexAxis } = args;

    const datasetHasLabels = ({ data }: ChartDataset) =>
      !!data?.some(
        (datapoint) => typeof datapoint === 'object' && typeof datapoint[indexAxis] === 'string'
      );

    /*
       Labels can be provided by the user two ways:
       1. As a seperate ChartLabel[] via the 'labels' input prop - this has highest priority
       2. Together with the dataset via the 'data' input prop - here each datapoint contains 
       a label for the indexAxis. 
       For example: { x: 'label1', y: 1} in the case where the index axis is 'x'. 

       If no labels are provided then default labels are used. 
    */
    const labelsAreGivenAsSeperateArray = labels !== undefined;
    const labelsAreGivenTogetherWithDataset = datasets.some(datasetHasLabels);

    if (labelsAreGivenAsSeperateArray) {
      return labels;
    } else if (labelsAreGivenTogetherWithDataset) {
      return null;
    } else {
      /* 
        Chart.js requires labels along the index axis to render anything therefore
        all other types than stock uses empty labels as default. The stock type 
        displays day & month as default. 
      */
      return type === 'stock'
        ? this.getDefaultStockLabels(datasets, this.locale)
        : this.createBlankLabels(datasets);
    }
  }

  private createConfigurationObject(
    type: ChartType,
    datasets: ChartDataset[],
    options: ChartOptions,
    labels?: ChartLabel[]
  ): ChartConfiguration {
    const typeConfig = this.chartConfigService.getTypeConfig(type);

    const indexAxis = typeConfig?.options?.indexAxis ?? 'x';
    const labelsToApply = this.getLabelsToApply({ labels, datasets, type, indexAxis });

    return mergeDeepAll(typeConfig, {
      data: {
        labels: labelsToApply,
        datasets,
      },
      options,
    }) as ChartConfiguration;
  }

  private addHighlightedElementsToDatasets(
    highlightedElements: ChartHighlightedElements,
    datasets: ChartDataset[]
  ) {
    highlightedElements.forEach(([datasetIndex, dataIndex]) => {
      const dataset = datasets[datasetIndex];
      if (!dataset) return;

      if (dataset?.kirbyOptions?.highlightedElements) {
        dataset.kirbyOptions.highlightedElements.push(dataIndex);
      } else {
        dataset.kirbyOptions = {
          ...dataset.kirbyOptions,
          highlightedElements: [dataIndex],
        };
      }
    });
  }
  private createDatasets(data: ChartDataset[] | number[]): ChartDataset[] {
    // We need to modify the datasets in order to add datalabels.
    if (
      this.dataLabelOptions?.showCurrent ||
      this.dataLabelOptions?.showMax ||
      this.dataLabelOptions?.showMin
    ) {
      data = this.addDataLabelsData(data);
    }
    let datasets = isNumberArray(data) ? [{ data }] : data;
    if (this.highlightedElements)
      this.addHighlightedElementsToDatasets(this.highlightedElements, datasets);

    /* 
       Hacky solution. Should be fixed in this issue:
      https://github.com/kirbydesign/designsystem/issues/1967 
    */
    if (this.chartType === 'stock') {
      datasets.forEach((dataset) => {
        dataset.kirbyOptions = {
          ...dataset.kirbyOptions,
          isStockChart: true,
        };
      });
    }

    return datasets;
  }
  /**
   * Decorate ChartDataset with properties to allow for datalabels.
   *
   * @param data
   * @returns ChartDataset[]
   */
  public addDataLabelsData(data: ChartDataset[] | number[]): ChartDataset[] {
    if (isNumberArray(data)) {
      throw Error("Currently it's impossible to add dataLabels to non ScatterDataPoint datasets");
    }

    const decorateDataPoint = (
      set: ChartDataset,
      axis: 'x' | 'y',
      direction: 'high' | 'low',
      position: 'bottom' | 'top' | 'left' | 'right'
    ): void => {
      const { value, pointer } = this.locateValueIndexInDataset(set, axis, direction);
      set.data[pointer] = {
        ...(set.data[pointer] as ScatterDataPoint),
        datalabel: {
          value: value + (this.dataLabelOptions.valueSuffix || ''),
          position,
        },
      } as ScatterDataPoint;
    };

    data.map((set) => {
      if (this.dataLabelOptions.showMin) {
        decorateDataPoint(set, 'y', 'low', 'bottom');
      }
      if (this.dataLabelOptions.showMax) {
        decorateDataPoint(set, 'y', 'high', 'top');
      }
      if (this.dataLabelOptions.showCurrent) {
        decorateDataPoint(set, 'x', 'high', 'right');
      }
    });
    return data;
  }

  private locateValueIndexInDataset(
    dataset: ChartDataset,
    axis: string,
    direction: 'low' | 'high'
  ): { value: number; pointer: number } {
    let pointer: number;
    let value: number;
    dataset.data.forEach((datapoint, index) => {
      if (direction == 'low' && (!value || datapoint[axis] < value)) {
        value = datapoint['y'];
        pointer = index;
      }
      if (direction == 'high' && (!value || datapoint[axis] > value)) {
        value = datapoint['y'];
        pointer = index;
      }
    });
    return { value, pointer };
  }
}
