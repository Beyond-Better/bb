FasdUAS 1.101.10   ��   ��    k             l     ��  ��      BB Manager for macOS     � 	 	 *   B B   M a n a g e r   f o r   m a c O S   
  
 l     ��������  ��  ��        l     ��  ��      Global variables     �   "   G l o b a l   v a r i a b l e s      p         ������ 0 projectsfile projectsFile��        p         ������ "0 lastprojectfile lastProjectFile��        l     ��������  ��  ��        l     ��  ��      Initialize     �      I n i t i a l i z e      i        !   I      �������� 0 
initialize  ��  ��   ! k     K " "  # $ # l     �� % &��   %   Set up file paths    & � ' ' $   S e t   u p   f i l e   p a t h s $  ( ) ( r      * + * b      , - , l    	 .���� . I    	�� / 0
�� .earsffdralis        afdr / m     ��
�� afdrdlib 0 �� 1 2
�� 
from 1 m    ��
�� fldmfldu 2 �� 3��
�� 
rtyp 3 m    ��
�� 
ctxt��  ��  ��   - m   	 
 4 4 � 5 5 L A p p l i c a t i o n   S u p p o r t : B B : b b - p r o j e c t s . t x t + o      ���� 0 projectsfile projectsFile )  6 7 6 r     8 9 8 b     : ; : l    <���� < I   �� = >
�� .earsffdralis        afdr = m    ��
�� afdrdlib > �� ? @
�� 
from ? m    ��
�� fldmfldu @ �� A��
�� 
rtyp A m    ��
�� 
ctxt��  ��  ��   ; m     B B � C C N A p p l i c a t i o n   S u p p o r t : B B : l a s t - p r o j e c t . t x t 9 o      ���� "0 lastprojectfile lastProjectFile 7  D E D l   ��������  ��  ��   E  F G F l   �� H I��   H ) # Ensure directories and files exist    I � J J F   E n s u r e   d i r e c t o r i e s   a n d   f i l e s   e x i s t G  K L K I   /�� M��
�� .sysoexecTEXT���     TEXT M b    + N O N m     P P � Q Q  m k d i r   - p   O n    * R S R 1   ( *��
�� 
strq S l   ( T���� T b    ( U V U n    & W X W 1   $ &��
�� 
psxp X l   $ Y���� Y I   $�� Z [
�� .earsffdralis        afdr Z m    ��
�� afdrdlib [ �� \��
�� 
from \ m     ��
�� fldmfldu��  ��  ��   V m   & ' ] ] � ^ ^ , A p p l i c a t i o n   S u p p o r t / B B��  ��  ��   L  _ ` _ I  0 =�� a��
�� .sysoexecTEXT���     TEXT a b   0 9 b c b m   0 3 d d � e e  t o u c h   c n   3 8 f g f 1   6 8��
�� 
strq g l  3 6 h���� h n   3 6 i j i 1   4 6��
�� 
psxp j o   3 4���� 0 projectsfile projectsFile��  ��  ��   `  k�� k I  > K�� l��
�� .sysoexecTEXT���     TEXT l b   > G m n m m   > A o o � p p  t o u c h   n n   A F q r q 1   D F��
�� 
strq r l  A D s���� s n   A D t u t 1   B D��
�� 
psxp u o   A B���� "0 lastprojectfile lastProjectFile��  ��  ��  ��     v w v l     ��������  ��  ��   w  x y x l     �� z {��   z  
 Main menu    { � | |    M a i n   m e n u y  } ~ } i      �  I     ������
�� .aevtoappnull  �   � ****��  ��   � k     � � �  � � � I     �������� 0 
initialize  ��  ��   �  � � � l   ��������  ��  ��   �  ��� � T    � � � k    } � �  � � � r     � � � I   �� � �
�� .gtqpchltns    @   @ ns   � J     � �  � � � m     � � � � �  L i s t   p r o j e c t s �  � � � m     � � � � �  A d d   p r o j e c t �  � � � m     � � � � �  R e m o v e   p r o j e c t �  � � � m     � � � � �  R u n   B B   c o m m a n d �  ��� � m     � � � � �  Q u i t��   � �� � �
�� 
prmp � m     � � � � � $ B B   P r o j e c t   M a n a g e r � �� ���
�� 
inSL � m     � � � � �  R u n   B B   c o m m a n d��   � o      ���� 
0 choice   �  � � � l   ��������  ��  ��   �  � � � Z    ( � ����� � =     � � � o    ���� 
0 choice   � m    ��
�� boovfals �  S   # $��  ��   �  � � � l  ) )��������  ��  ��   �  � � � r   ) / � � � n   ) - � � � 4   * -�� �
�� 
cobj � m   + ,����  � o   ) *���� 
0 choice   � o      ����  0 selectedchoice selectedChoice �  � � � l  0 0��������  ��  ��   �  ��� � Z   0 } � � ��� � =  0 5 � � � o   0 1����  0 selectedchoice selectedChoice � m   1 4 � � � � �  L i s t   p r o j e c t s � I   8 =�������� 0 listprojects listProjects��  ��   �  � � � =  @ E � � � o   @ A����  0 selectedchoice selectedChoice � m   A D � � � � �  A d d   p r o j e c t �  � � � I   H M�������� 0 
addproject 
addProject��  ��   �  � � � =  P U � � � o   P Q����  0 selectedchoice selectedChoice � m   Q T � � � � �  R e m o v e   p r o j e c t �  � � � I   X ]�������� 0 removeproject removeProject��  ��   �  � � � =  ` e � � � o   ` a����  0 selectedchoice selectedChoice � m   a d � � � � �  R u n   B B   c o m m a n d �  � � � I   h m�������� 0 
runcommand 
runCommand��  ��   �  � � � =  p u � � � o   p q����  0 selectedchoice selectedChoice � m   q t � � � � �  Q u i t �  ��� �  S   x y��  ��  ��  ��   ~  � � � l     ����~��  �  �~   �  � � � l     �} � ��}   �   List projects    � � � �    L i s t   p r o j e c t s �  � � � i     � � � I      �|�{�z�| 0 listprojects listProjects�{  �z   � Q     z � � � � k    _ � �  � � � r     � � � n     � � � 2   �y
�y 
cpar � l    ��x�w � I   �v ��u
�v .rdwrread****        **** � 4    
�t �
�t 
psxf � l   	 ��s�r � n    	 � � � 1    �q
�q 
psxp � o    �p�p 0 projectsfile projectsFile�s  �r  �u  �x  �w   � o      �o�o 0 projectlist projectList �  ��n � Z    _ �m  =    n     1    �l
�l 
leng o    �k�k 0 projectlist projectList m    �j�j   I   &�i
�i .sysodlogaskr        TEXT m    		 �

 . N o   p r o j e c t s   c o n f i g u r e d . �h
�h 
btns J      �g m     �  O K�g   �f�e
�f 
dflt m   ! " �  O K�e  �m   k   ) _  r   ) , m   ) * �   o      �d�d 0 projecttext projectText  Y   - O�c�b r   : J !  b   : H"#" b   : D$%$ b   : ?&'& b   : =()( o   : ;�a�a 0 projecttext projectText) o   ; <�`�` 0 i  ' m   = >** �++  .  % n   ? C,-, 4   @ C�_.
�_ 
cobj. o   A B�^�^ 0 i  - o   ? @�]�] 0 projectlist projectList# o   D G�\
�\ 
ret ! o      �[�[ 0 projecttext projectText�c 0 i   m   0 1�Z�Z  n   1 5/0/ 1   2 4�Y
�Y 
leng0 o   1 2�X�X 0 projectlist projectList�b   1�W1 I  P _�V23
�V .sysodlogaskr        TEXT2 o   P Q�U�U 0 projecttext projectText3 �T45
�T 
btns4 J   R W66 7�S7 m   R U88 �99  O K�S  5 �R:�Q
�R 
dflt: m   X [;; �<<  O K�Q  �W  �n   � R      �P=�O
�P .ascrerr ****      � ****= o      �N�N 0 errmsg errMsg�O   � I  g z�M>?
�M .sysodlogaskr        TEXT> b   g l@A@ m   g jBB �CC : E r r o r   r e a d i n g   p r o j e c t s   f i l e :  A o   j k�L�L 0 errmsg errMsg? �KDE
�K 
btnsD J   m rFF G�JG m   m pHH �II  O K�J  E �IJ�H
�I 
dfltJ m   s vKK �LL  O K�H   � MNM l     �G�F�E�G  �F  �E  N OPO l     �DQR�D  Q   Add project   R �SS    A d d   p r o j e c tP TUT i    VWV I      �C�B�A�C 0 
addproject 
addProject�B  �A  W k     WXX YZY r     [\[ n     	]^] 1    	�@
�@ 
ttxt^ l    _�?�>_ I    �=`a
�= .sysodlogaskr        TEXT` m     bb �cc b E n t e r   t h e   f u l l   p a t h   o f   t h e   n e w   p r o j e c t   d i r e c t o r y :a �<d�;
�< 
dtxtd m    ee �ff  �;  �?  �>  \ o      �:�: 0 
newproject 
newProjectZ g�9g Z    Whi�8�7h >   jkj o    �6�6 0 
newproject 
newProjectk m    ll �mm  i Q    Snopn k    6qq rsr I   &�5t�4
�5 .sysoexecTEXT���     TEXTt b    "uvu b    wxw b    yzy m    {{ �|| 
 e c h o  z n    }~} 1    �3
�3 
strq~ o    �2�2 0 
newproject 
newProjectx m     ���    > >  v n    !��� 1    !�1
�1 
strq� l   ��0�/� n    ��� 1    �.
�. 
psxp� o    �-�- 0 projectsfile projectsFile�0  �/  �4  s ��,� I  ' 6�+��
�+ .sysodlogaskr        TEXT� m   ' (�� ��� 6 P r o j e c t   a d d e d   s u c c e s s f u l l y .� �*��
�* 
btns� J   ) ,�� ��)� m   ) *�� ���  O K�)  � �(��'
�( 
dflt� m   - 0�� ���  O K�'  �,  o R      �&��%
�& .ascrerr ****      � ****� o      �$�$ 0 errmsg errMsg�%  p I  > S�#��
�# .sysodlogaskr        TEXT� b   > C��� m   > A�� ��� , E r r o r   a d d i n g   p r o j e c t :  � o   A B�"�" 0 errmsg errMsg� �!��
�! 
btns� J   D I�� �� � m   D G�� ���  O K�   � ���
� 
dflt� m   J M�� ���  O K�  �8  �7  �9  U ��� l     ����  �  �  � ��� l     ����  �   Remove project   � ���    R e m o v e   p r o j e c t� ��� i    ��� I      ���� 0 removeproject removeProject�  �  � Q     ����� k    ��� ��� r    ��� n    ��� 2   �
� 
cpar� l   ���� I   ���
� .rdwrread****        ****� 4    
��
� 
psxf� l   	���� n    	��� 1    �
� 
psxp� o    �� 0 projectsfile projectsFile�  �  �  �  �  � o      �� 0 projectlist projectList� ��� Z    ����
�� =   ��� n    ��� 1    �	
�	 
leng� o    �� 0 projectlist projectList� m    ��  � I   &���
� .sysodlogaskr        TEXT� m    �� ��� . N o   p r o j e c t s   c o n f i g u r e d .� ���
� 
btns� J     �� ��� m    �� ���  O K�  � ���
� 
dflt� m   ! "�� ���  O K�  �
  � k   ) ��� ��� r   ) 2��� I  ) 0���
� .gtqpchltns    @   @ ns  � o   ) *� �  0 projectlist projectList� �����
�� 
prmp� m   + ,�� ��� 6 S e l e c t   a   p r o j e c t   t o   r e m o v e :��  � o      ���� 
0 choice  � ���� Z   3 �������� >  3 6��� o   3 4���� 
0 choice  � m   4 5��
�� boovfals� k   9 ��� ��� r   9 A��� n   9 ?��� 4   : ?���
�� 
cobj� m   = >���� � o   9 :���� 
0 choice  � o      ���� "0 projecttoremove projectToRemove� ��� I  B �����
�� .sysoexecTEXT���     TEXT� b   B {��� b   B s��� b   B o��� b   B g��� b   B c��� b   B [��� b   B W��� b   B O��� b   B K��� m   B E   �  g r e p   - v  � n   E J 1   F J��
�� 
strq o   E F���� "0 projecttoremove projectToRemove� m   K N �   � n   O V 1   R V��
�� 
strq l  O R���� n   O R	
	 1   P R��
�� 
psxp
 o   O P���� 0 projectsfile projectsFile��  ��  � m   W Z �    >  � n   [ b 1   ^ b��
�� 
strq l  [ ^���� n   [ ^ 1   \ ^��
�� 
psxp o   [ \���� 0 projectsfile projectsFile��  ��  � m   c f �  . t m p   & &   m v  � n   g n 1   j n��
�� 
strq l  g j���� n   g j 1   h j��
�� 
psxp o   g h���� 0 projectsfile projectsFile��  ��  � m   o r � 
 . t m p  � n   s z 1   v z��
�� 
strq l  s v���� n   s v 1   t v��
�� 
psxp o   s t���� 0 projectsfile projectsFile��  ��  ��  �  ��  I  � ���!"
�� .sysodlogaskr        TEXT! m   � �## �$$ : P r o j e c t   r e m o v e d   s u c c e s s f u l l y ." ��%&
�� 
btns% J   � �'' (��( m   � �)) �**  O K��  & ��+��
�� 
dflt+ m   � �,, �--  O K��  ��  ��  ��  ��  �  � R      ��.��
�� .ascrerr ****      � ****. o      ���� 0 errmsg errMsg��  � I  � ���/0
�� .sysodlogaskr        TEXT/ b   � �121 m   � �33 �44 0 E r r o r   r e m o v i n g   p r o j e c t :  2 o   � ����� 0 errmsg errMsg0 ��56
�� 
btns5 J   � �77 8��8 m   � �99 �::  O K��  6 ��;��
�� 
dflt; m   � �<< �==  O K��  � >?> l     ��������  ��  ��  ? @A@ l     ��BC��  B   Run BB command   C �DD    R u n   B B   c o m m a n dA E��E i    FGF I      �������� 0 
runcommand 
runCommand��  ��  G Q    �HIJH k   �KK LML r    NON n    PQP 2   ��
�� 
cparQ l   R����R I   ��S��
�� .rdwrread****        ****S 4    
��T
�� 
psxfT l   	U����U n    	VWV 1    ��
�� 
psxpW o    ���� 0 projectsfile projectsFile��  ��  ��  ��  ��  O o      ���� 0 projectlist projectListM XYX Z    -Z[����Z =   \]\ n    ^_^ 1    ��
�� 
leng_ o    ���� 0 projectlist projectList] m    ����  [ k    )`` aba I   &��cd
�� .sysodlogaskr        TEXTc m    ee �ff f N o   p r o j e c t s   c o n f i g u r e d .   P l e a s e   a d d   a   p r o j e c t   f i r s t .d ��gh
�� 
btnsg J     ii j��j m    kk �ll  O K��  h ��m��
�� 
dfltm m   ! "nn �oo  O K��  b p��p L   ' )����  ��  ��  ��  Y qrq l  . .��������  ��  ��  r sts Z   . �uv��wu =  . 3xyx n   . 1z{z 1   / 1��
�� 
leng{ o   . /���� 0 projectlist projectListy m   1 2���� v r   6 <|}| n   6 :~~ 4   7 :���
�� 
cobj� m   8 9����  o   6 7���� 0 projectlist projectList} o      ���� "0 selectedproject selectedProject��  w k   ? ��� ��� Q   ? \���� r   B O��� I  B M�����
�� .rdwrread****        ****� 4   B I���
�� 
psxf� l  D H������ n   D H��� 1   E G��
�� 
psxp� o   D E���� "0 lastprojectfile lastProjectFile��  ��  ��  � o      ���� 0 lastproject lastProject� R      ������
�� .ascrerr ****      � ****��  ��  � r   W \��� m   W Z�� ���  � o      ���� 0 lastproject lastProject� ��� l  ] ]��������  ��  ��  � ��� r   ] p��� I  ] n����
�� .gtqpchltns    @   @ ns  � o   ] ^���� 0 projectlist projectList� ����
�� 
prmp� m   a d�� ��� " S e l e c t   a   p r o j e c t :� �����
�� 
inSL� J   g j�� ���� o   g h���� 0 lastproject lastProject��  ��  � o      ���� 
0 choice  � ��� Z   q }������� =  q t��� o   q r���� 
0 choice  � m   r s��
�� boovfals� L   w y����  ��  ��  � ��� r   ~ ���� n   ~ ���� 4    ����
�� 
cobj� m   � ����� � o   ~ ���� 
0 choice  � o      ���� "0 selectedproject selectedProject� ���� I  � ������
�� .sysoexecTEXT���     TEXT� b   � ���� b   � ���� b   � ���� m   � ��� ��� 
 e c h o  � n   � ���� 1   � ��
� 
strq� o   � ��~�~ "0 selectedproject selectedProject� m   � ��� ���    >  � n   � ���� 1   � ��}
�} 
strq� l  � ���|�{� n   � ���� 1   � ��z
�z 
psxp� o   � ��y�y "0 lastprojectfile lastProjectFile�|  �{  ��  ��  t ��� l  � ��x�w�v�x  �w  �v  � ��� l  � ����� r   � ���� I  � ��u��
�u .gtqpchltns    @   @ ns  � v   � ��� ��� m   � ��� ���  i n i t� ��� m   � ��� ��� 
 s t a r t� ��t� m   � ��� ���  s t o p�t  � �s��r
�s 
prmp� m   � ��� ��� " S e l e c t   a   c o m m a n d :�r  � o      �q�q 
0 choice  � "  default items {lastProject}   � ��� 8   d e f a u l t   i t e m s   { l a s t P r o j e c t }� ��� Z   � ����p�o� =  � ���� o   � ��n�n 
0 choice  � m   � ��m
�m boovfals� L   � ��l�l  �p  �o  � ��� r   � ���� n   � ���� 4   � ��k�
�k 
cobj� m   � ��j�j � o   � ��i�i 
0 choice  � o      �h�h 0 command  � ��� l  � ��g�f�e�g  �f  �e  � ��d� Z   �����c�� G   � ���� G   � ���� =  � ���� o   � ��b�b 0 command  � m   � ��� ���  i n i t� =  � ���� o   � ��a�a 0 command  � m   � ��� ��� 
 s t a r t� =  � ���� o   � ��`�` 0 command  � m   � ��� ���  s t o p� Z   ��� �_� =  � � o   � ��^�^ 0 command   m   � � �  i n i t  k   �Y  O   �A	
	 k   �@  I  � ��]�\�[
�] .miscactvnull��� ��� null�\  �[    I  ��Z�Y
�Z .coredoscnull��� ��� ctxt m   � � T e c h o   ' P r e p a r i n g   t o   r u n   b b   i n i t '   & &   s l e e p   1�Y    l  I �X�W
�X .sysodelanull��� ��� nmbr m  
�V�V �W   ^ X Longer delay before running bb init, to ensure complex bash/zsh profiles finish running    � �   L o n g e r   d e l a y   b e f o r e   r u n n i n g   b b   i n i t ,   t o   e n s u r e   c o m p l e x   b a s h / z s h   p r o f i l e s   f i n i s h   r u n n i n g  l �U�U   V Pdo script "cd " & quoted form of selectedProject & " && sleep 1" in front window    � � d o   s c r i p t   " c d   "   &   q u o t e d   f o r m   o f   s e l e c t e d P r o j e c t   &   "   & &   s l e e p   1 "   i n   f r o n t   w i n d o w   I )�T!"
�T .coredoscnull��� ��� ctxt! b  #$# b  %&% m  '' �((  c d  & n  )*) 1  �S
�S 
strq* o  �R�R "0 selectedproject selectedProject$ m  ++ �,,    & &   e c h o   ' '" �Q-�P
�Q 
kfil- 4 %�O.
�O 
cwin. m  #$�N�N �P    /0/ l */1231 I */�M4�L
�M .sysodelanull��� ��� nmbr4 m  *+�K�K �L  2   delay for `cd` to run   3 �55 ,   d e l a y   f o r   ` c d `   t o   r u n0 6�J6 I 0@�I78
�I .coredoscnull��� ��� ctxt7 m  0399 �:: , / u s r / l o c a l / b i n / b b   i n i t8 �H;�G
�H 
kfil; 4 6<�F<
�F 
cwin< m  :;�E�E �G  �J  
 m   � �==�                                                                                      @ alis    <  Mobar                      �Օ�BD ����Terminal.app                                                   �����Օ�        ����  
 cu             	Utilities   -/:System:Applications:Utilities:Terminal.app/     T e r m i n a l . a p p    M o b a r  *System/Applications/Utilities/Terminal.app  / ��   >?> I BG�D�C�B
�D .miscactvnull��� ��� null�C  �B  ? @�A@ I HY�@AB
�@ .sysodlogaskr        TEXTA m  HKCC �DD � B B   i n i t   c o m m a n d   h a s   b e e n   l a u n c h e d   i n   T e r m i n a l .   P l e a s e   c o m p l e t e   t h e   i n i t i a l i z a t i o n   p r o c e s s   t h e r e .B �?EF
�? 
btnsE J  LQGG H�>H m  LOII �JJ  O K�>  F �=K�<
�= 
dfltK m  RULL �MM  O K�<  �A  �_   k  \�NN OPO I \o�;Q�:
�; .sysoexecTEXT���     TEXTQ b  \kRSR b  \iTUT b  \eVWV m  \_XX �YY  c d  W n  _dZ[Z 1  `d�9
�9 
strq[ o  _`�8�8 "0 selectedproject selectedProjectU m  eh\\ �]] ,   & &   / u s r / l o c a l / b i n / b b  S o  ij�7�7 0 command  �:  P ^�6^ Z  p�_`a�5_ = pubcb o  pq�4�4 0 command  c m  qtdd �ee 
 s t a r t` I x��3fg
�3 .sysodlogaskr        TEXTf m  x{hh �ii Z B B   h a s   b e e n   s t a r t e d   f o r   t h e   s e l e c t e d   p r o j e c t .g �2jk
�2 
btnsj J  |�ll m�1m m  |nn �oo  O K�1  k �0p�/
�0 
dfltp m  ��qq �rr  O K�/  a sts = ��uvu o  ���.�. 0 command  v m  ��ww �xx  s t o pt y�-y I ���,z{
�, .sysodlogaskr        TEXTz m  ��|| �}} Z B B   h a s   b e e n   s t o p p e d   f o r   t h e   s e l e c t e d   p r o j e c t .{ �+~
�+ 
btns~ J  ���� ��*� m  ���� ���  O K�*   �)��(
�) 
dflt� m  ���� ���  O K�(  �-  �5  �6  �c  � I ���'��
�' .sysodlogaskr        TEXT� m  ���� ��� b I n v a l i d   c o m m a n d .   P l e a s e   u s e   i n i t ,   s t a r t ,   o r   s t o p .� �&��
�& 
btns� J  ���� ��%� m  ���� ���  O K�%  � �$��#
�$ 
dflt� m  ���� ���  O K�#  �d  I R      �"��!
�" .ascrerr ****      � ****� o      � �  0 errmsg errMsg�!  J I �����
� .sysodlogaskr        TEXT� b  ����� m  ���� ��� . E r r o r   r u n n i n g   c o m m a n d :  � o  ���� 0 errmsg errMsg� ���
� 
btns� J  ���� ��� m  ���� ���  O K�  � ���
� 
dflt� m  ���� ���  O K�  ��       ���������������  � ������������� 0 
initialize  
� .aevtoappnull  �   � ****� 0 listprojects listProjects� 0 
addproject 
addProject� 0 removeproject removeProject� 0 
runcommand 
runCommand� 0 projectsfile projectsFile� "0 lastprojectfile lastProjectFile� 
0 choice  �  0 selectedchoice selectedChoice�  �  � �
 !�	�����
 0 
initialize  �	  �  �  � �������  4�� B�� P�� ]���� d o
� afdrdlib
� 
from
� fldmfldu
� 
rtyp
� 
ctxt� 
�  .earsffdralis        afdr�� 0 projectsfile projectsFile�� "0 lastprojectfile lastProjectFile
�� 
psxp
�� 
strq
�� .sysoexecTEXT���     TEXT� L������ �%E�O������ �%E�O����l �,�%�,%j Oa ��,�,%j Oa ��,�,%j � �� ���������
�� .aevtoappnull  �   � ****��  ��  �  � �� � � � � ����� ��� ����������� ��� ��� ��� ��� ��� 0 
initialize  �� 
�� 
prmp
�� 
inSL�� 
�� .gtqpchltns    @   @ ns  �� 
0 choice  
�� 
cobj��  0 selectedchoice selectedChoice�� 0 listprojects listProjects�� 0 
addproject 
addProject�� 0 removeproject removeProject�� 0 
runcommand 
runCommand�� �*j+  O {hZ������v����� E�O�f  Y hO��k/E�O�a   
*j+ Y ?�a   
*j+ Y /�a   
*j+ Y �a   
*j+ Y �a   Y h[OY��� �� ����������� 0 listprojects listProjects��  ��  � ���������� 0 projectlist projectList�� 0 projecttext projectText�� 0 i  �� 0 errmsg errMsg� ������������	��������*����8;����BHK
�� 
psxf�� 0 projectsfile projectsFile
�� 
psxp
�� .rdwrread****        ****
�� 
cpar
�� 
leng
�� 
btns
�� 
dflt�� 
�� .sysodlogaskr        TEXT
�� 
cobj
�� 
ret �� 0 errmsg errMsg��  �� { a*���,E/j �-E�O��,j  ���kv��� Y 8�E�O !k��,Ekh ��%�%��/%_ %E�[OY��O��a kv�a � W X  a �%�a kv�a � � ��W���������� 0 
addproject 
addProject��  ��  � ������ 0 
newproject 
newProject�� 0 errmsg errMsg� b��e����l{������������������������
�� 
dtxt
�� .sysodlogaskr        TEXT
�� 
ttxt
�� 
strq�� 0 projectsfile projectsFile
�� 
psxp
�� .sysoexecTEXT���     TEXT
�� 
btns
�� 
dflt�� �� 0 errmsg errMsg��  �� X���l �,E�O�� F &��,%�%��,�,%j O���kv�a a  W X  a �%�a kv�a a  Y h� ������������� 0 removeproject removeProject��  ��  � ���������� 0 projectlist projectList�� 
0 choice  �� "0 projecttoremove projectToRemove�� 0 errmsg errMsg�  ������������������������������ ����#),����39<
�� 
psxf�� 0 projectsfile projectsFile
�� 
psxp
�� .rdwrread****        ****
�� 
cpar
�� 
leng
�� 
btns
�� 
dflt�� 
�� .sysodlogaskr        TEXT
�� 
prmp
�� .gtqpchltns    @   @ ns  
�� 
cobj
�� 
strq
�� .sysoexecTEXT���     TEXT�� 0 errmsg errMsg��  �� � �*���,E/j �-E�O��,j  ���kv��� Y n���l E�O�f ]�a k/E�Oa �a ,%a %��,a ,%a %��,a ,%a %��,a ,%a %��,a ,%j Oa �a kv�a � Y hW X  a �%�a kv�a � � ��G���������� 0 
runcommand 
runCommand��  ��  � �������������� 0 projectlist projectList�� "0 selectedproject selectedProject�� 0 lastproject lastProject�� 
0 choice  �� 0 command  �� 0 errmsg errMsg� B������������e��k��n�����������������������������������=��������'+����9CILX\dhnqw|����������
�� 
psxf�� 0 projectsfile projectsFile
�� 
psxp
�� .rdwrread****        ****
�� 
cpar
�� 
leng
�� 
btns
�� 
dflt�� 
�� .sysodlogaskr        TEXT
�� 
cobj�� "0 lastprojectfile lastProjectFile��  ��  
�� 
prmp
�� 
inSL
�� .gtqpchltns    @   @ ns  
�� 
strq
�� .sysoexecTEXT���     TEXT
�� 
bool
�� .miscactvnull��� ��� null
�� .coredoscnull��� ��� ctxt�� 
�� .sysodelanull��� ��� nmbr
�� 
kfil
�� 
cwin�� 0 errmsg errMsg����*���,E/j �-E�O��,j  ���kv��� OhY hO��,k  ��k/E�Y a *���,E/j E�W X  a E�O�a a a �kv� E�O�f  hY hO��k/E�Oa �a ,%a %��,a ,%j Oa a a ma a l E�O�f  hY hO��k/E�O�a  
 �a  a  &
 �a ! a  & äa "  ka # I*j $Oa %j &Oa 'j (Oa )�a ,%a *%a +*a ,k/l &Okj (Oa -a +*a ,k/l &UO*j $Oa .�a /kv�a 0� Y Oa 1�a ,%a 2%�%j O�a 3  a 4�a 5kv�a 6� Y �a 7  a 8�a 9kv�a :� Y hY a ;�a <kv�a =� W X > a ?�%�a @kv�a A� � ��� | M o b a r : U s e r s : c n g : L i b r a r y : A p p l i c a t i o n   S u p p o r t : B B : b b - p r o j e c t s . t x t� ��� ~ M o b a r : U s e r s : c n g : L i b r a r y : A p p l i c a t i o n   S u p p o r t : B B : l a s t - p r o j e c t . t x t� ����� �  �� ���  Q u i t�  �  ascr  ��ޭ