export const money = (value: string | number) => Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 2)

export const compactSales = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)}万+` : `${value}+`

export const formatDate = (value: string) => {
  const date = new Date(value)
  return `${date.getMonth() + 1}月${String(date.getDate()).padStart(2, '0')}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
