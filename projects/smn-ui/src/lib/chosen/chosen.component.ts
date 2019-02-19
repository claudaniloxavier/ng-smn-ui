import {
    AfterContentInit,
    AfterViewInit,
    Component,
    ContentChildren,
    ElementRef,
    EventEmitter, forwardRef, HostListener,
    Input, OnChanges,
    OnInit,
    Output,
    QueryList, TemplateRef, ViewChild, ViewContainerRef
} from '@angular/core';
import {FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR} from '@angular/forms';
import {UiChosenOptionComponent} from './chosen-option/chosen-option.component';
import {UiElement} from '../utils/providers/element.provider';
import {UiChosenGroupComponent} from './chosen-group/chosen-group.component';
import {unaccent} from '../utils/functions/unaccent';

// TODO: Animation
// TODO: Export render, open, close

@Component({
    selector: 'ui-chosen',
    templateUrl: './chosen.component.html',
    styleUrls: ['./chosen.component.scss'],
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: UiChosenComponent,
        multi: true,
    }, {
        provide: NG_VALIDATORS,
        useExisting: forwardRef(() => UiChosenComponent),
        multi: true
    }]
})
export class UiChosenComponent implements OnInit, AfterViewInit, OnChanges, AfterContentInit {

    viewRef: any;
    value: any;
    focused: boolean;
    searchText: string;
    isMobile: boolean;
    control: any;

    @Input() search: any;
    @Input() ngModel: any;
    @Input() required: boolean;
    @Input() placeholder: string;
    @Input() persistPlaceholder: string;

    @Output() ngModelChange: EventEmitter<any> = new EventEmitter<any>();

    @ViewChild('optionTemplate') optionTemplate: TemplateRef<any>;
    @ViewChild('inputSearch') inputSearch: ElementRef;
    @ViewChild('nativeSelect') nativeSelect: ElementRef;

    /**
     * O param "descendants" fala para o @ContentChildren pegar todos components UiChosenOptionComponent
     * mesmo que eles estejam dentro de outros components(UiChosenGroupComponent)
     */
    @ContentChildren(UiChosenOptionComponent, {descendants: true}) options: QueryList<UiChosenOptionComponent>;

    // Pegando os options que foram colocados sem o group
    @ContentChildren(UiChosenOptionComponent) onlyOptions: QueryList<UiChosenOptionComponent>;

    @ContentChildren(UiChosenGroupComponent, {descendants: true}) optionsGroup: QueryList<UiChosenGroupComponent>;

    constructor(private element: ElementRef,
                private viewContainerRef: ViewContainerRef) {
    }

    ngOnInit() {
    }

    ngAfterViewInit() {
        this.element.nativeElement.setAttribute('tabindex', '0');

        UiElement.on(window, 'resize scroll', () => {
            this.close();
        });

        if (/Mobi|Android/.test(navigator.userAgent)) {
            this.isMobile = true;

            this.element.nativeElement.classList.add('mobile');
        }
    }

    ngOnChanges(changes) {
        if (changes.ngModel && !changes.ngModel.firstChange) {
            this.setValue(changes.ngModel.currentValue);
        }

        if (changes.required && !changes.required.firstChange) {
            this.required = changes.required.currentValue;
        }
    }

    ngAfterContentInit() {
        if (this.ngModel) {
            setTimeout(() => this.setValue(this.ngModel));
        }
    }

    writeValue() {
    }

    registerOnChange() {
    }

    registerOnTouched() {
    }

    validate(control: FormControl): { [key: string]: any } {
        this.control = control;

        if (!control.value && control.value !== 0) {
            return {required: true};
        }

        return null;
    }

    @HostListener('focus')
    onFocus() {
        if (this.isMobile) {
            this.nativeSelect.nativeElement.focus();
            return;
        }

        if (this.focused) {
            return;
        }

        this.clearFilter();

        if (this.search) {
            setTimeout(() => this.inputSearch.nativeElement.focus(), 100);
        }

        this.focused = true;

        const position = UiElement.position(this.element.nativeElement);
        const coordinate = {
            x: position.left,
            y: position.top + this.element.nativeElement.clientHeight
        };

        this.render(coordinate);
    }

    render(coordinate) {
        this.viewRef = this.viewContainerRef.createEmbeddedView(this.optionTemplate);
        this.viewRef.detectChanges();

        this.viewRef.rootNodes.forEach(rootNode => {
            document.body.appendChild(rootNode);

            if (rootNode.clientWidth && !rootNode.classList.contains('wrap-chosen-overlay')) {
                this.open(rootNode, coordinate);
            }
        });
    }

    open(element, coordinate) {
        setTimeout(() => {
            const verticalCoveringArea = coordinate.y + element.clientHeight;
            const bodyHeight = document.body.clientHeight;
            const windowHeight = bodyHeight + (document.body.scrollTop || window.scrollY || window.pageYOffset);

            if (verticalCoveringArea > windowHeight) {
                coordinate.y = windowHeight - (element.clientHeight + 8);
            }

            if (coordinate.y <= 0) {
                coordinate.y = 0;
            }

            const content = element.querySelector('ui-card > .content');
            const contentHeight = content.clientHeight;

            const search = element.querySelector('ui-card > .search');
            const searchHeight =  (search ? search.clientHeight : 0);

            content.style.maxHeight = (contentHeight > bodyHeight ? (bodyHeight - searchHeight) : contentHeight)  + 'px';

            element.style.transform = '';
            element.style.top = coordinate.y + 'px';
            element.style.left = coordinate.x + 'px';

            const card = element.querySelector('ui-card');
            card.style.maxHeight = window.innerHeight + 'px';
            card.style.maxWidth = (window.innerWidth - 16) + 'px';
            card.style.width = this.element.nativeElement.clientWidth + 'px';


            element.classList.add('open');
        });
    }

    close() {
        this.focused = false;

        if (this.viewContainerRef.length) {
            const viewRef = this.viewRef; // Salvando a referência para achar o index deste componente

            viewRef.rootNodes.forEach(rootNode => {
                if (rootNode.classList) {
                    rootNode.classList.remove('open');
                }
            });

            setTimeout(() => this.viewContainerRef.remove(this.viewContainerRef.indexOf(viewRef)), 280);
        }
    }

    setValue(value) {
        this.options.map(option => {
            if (option.value !== value) {
                option.setActive(false);
                return;
            }

            this.value = option.label;
            option.setActive(true);
        });
    }

    select(option) {
        this.control.markAsDirty();
        this.control.markAsTouched();
        this.ngModelChange.emit(option.value);
        this.close();
    }

    filterList() {
        this.options.map(option => {
            option.hidden = this.searchText ? !unaccent(option.label.toLowerCase()).includes(unaccent(this.searchText.toLowerCase())) : false;
        });

        this.optionsGroup.map(group => {
            group.hidden = group.options.filter(option => !option.hidden).length === 0;
        });
    }

    clearFilter() {
        this.searchText = null;
        this.filterList();
    }

    changeNativeSelect() {
        this.control.markAsDirty();
        this.control.markAsTouched();
        this.ngModelChange.emit(this.ngModel);
    }
}