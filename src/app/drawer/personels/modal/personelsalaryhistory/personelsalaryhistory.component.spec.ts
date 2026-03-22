import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PersonelsalaryhistoryComponent } from './personelsalaryhistory.component';

describe('PersonelsalaryhistoryComponent', () => {
  let component: PersonelsalaryhistoryComponent;
  let fixture: ComponentFixture<PersonelsalaryhistoryComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PersonelsalaryhistoryComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PersonelsalaryhistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
