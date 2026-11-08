import { useDialog } from './useDialog';
import styles from './Modal.module.css';
export default function Modal({isOpen,onClose,text}) {
 const ref=useDialog(isOpen,onClose);
 if(!isOpen)return null;
 return <div className={styles.overlay} onClick={onClose}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Сообщение" ref={ref} tabIndex={-1} onClick={e=>e.stopPropagation()}><p className={styles.text}>{text}</p><button className="primary-button" onClick={onClose}>Понятно</button></section></div>
}