/**
 * 品牌 Logo 组件：以 SVG 绘制的 "A" 形图标。
 *
 * 纯矢量实现，颜色跟随 currentColor，可用于侧边栏、登录页与分享页，
 * 通过 title 提供无障碍名称。
 */
interface BrandLogoProps {
  className?: string
  title?: string
}

/** 品牌图标：三个圆点 + 折线组成字母 A */
const BrandLogo: React.FC<BrandLogoProps> = ({ className, title }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
  >
    {title && <title>{title}</title>}
    <path d="M5 18.5 11.9 5l7.1 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.2 13.2h7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="11.9" cy="5" r="1.7" fill="white" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="5" cy="18.5" r="1.7" fill="white" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="19" cy="18.5" r="1.7" fill="white" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

export default BrandLogo
