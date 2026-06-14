import { DatePicker, type DatePickerProps } from '../../../components/ui/DatePicker'

// TodoDatePicker 保留 ToDo 既有 import 入口，实际复用通用 DatePicker。
export function TodoDatePicker(props: DatePickerProps) {
  return <DatePicker {...props} />
}
